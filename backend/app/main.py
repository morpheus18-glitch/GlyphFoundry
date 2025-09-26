"""Quantum Nexus FastAPI application."""
from __future__ import annotations

import logging

from datetime import datetime
from fastapi import FastAPI, Depends, Request, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

# Logging config (fallback to basic if module missing)
try:
    from logging_config import configure_logging
except Exception:
    def configure_logging(*_a, **_k):
        logging.basicConfig(level=logging.INFO)

from settings import settings
from db import get_db
from exports import export_graph_json, export_tags_json
from kafka_bus import produce
# optional: create minimal schema if migrations/init haven’t run
try:
    from ensure_schema import ensure_min_schema  # only if you created it
except Exception:
    ensure_min_schema = None  # harmless if absent

# ---------------- App & middleware ----------------
configure_logging("INFO")
app = FastAPI(title="Glyph Foundry API", version="1.0.0")
from routes import router as api_router
app.include_router(api_router)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Optional: auto-include routers ----------------
def _try_include_routers():
    candidates = [
        ("routes", ["router", "api", "app_router"]),
        ("api", ["router", "api", "app_router"]),
        ("endpoints", ["router", "api", "app_router"]),
    ]
    for mod_name, attrs in candidates:
        try:
            mod = importlib.import_module(mod_name)
        except Exception:
            continue
        for attr in attrs:
            r = getattr(mod, attr, None)
            if r is not None:
                try:
                    app.include_router(r)
                    logging.getLogger(__name__).info("Included router: %s.%s", mod_name, attr)
                except Exception as e:
                    logging.getLogger(__name__).warning("Failed to include %s.%s: %s", mod_name, attr, e)

_try_include_routers()

# ---------------- Lifecycle ----------------
@app.on_event("startup")
def _startup():
    # light, non-blocking boot tasks
    if ensure_min_schema is not None:
        try:
            db = next(get_db())
            ensure_min_schema(db)
        except Exception as e:
            logging.getLogger(__name__).warning("ensure_min_schema skipped: %s", e)

# ---------------- Health & error handler ----------------
@app.get("/healthz", response_class=PlainTextResponse)
def healthz():
    return "ok"

@app.exception_handler(Exception)
async def unhandled_exc(_: Request, exc: Exception):
    # keep responses JSON-ish even on unexpected errors
    return JSONResponse(status_code=500, content={"error": "internal", "detail": str(exc)})

# ---------------- Public endpoints ----------------
@app.get("/graph3d/data")
def graph3d_data(
    window_minutes: int = Query(60, alias="w", ge=1),
    limit_nodes: int = Query(300, alias="ln", ge=1),
    limit_edges: int = Query(1500, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    return export_graph_json(db, limit_nodes, limit_edges, window_minutes)

@app.get("/tags/data")
def tags_data(db: Session = Depends(get_db)):
    return export_tags_json(db)

# --- Override /graph3d/data with tunables + fallback ---
@app.get("/graph3d/data")
def graph3d_data(
    w: int = Query(settings.graph3d.default_window, alias="w", ge=1),
    ln: int = Query(settings.graph3d.default_nodes, alias="ln", ge=1),
    le: int = Query(settings.graph3d.default_edges, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    # clamp
    ln = min(ln, settings.graph3d.max_nodes)
    le = min(le, settings.graph3d.max_edges)

    payload = export_graph_json(db, ln, le, w)
    if payload["stats"]["edge_count"] == 0 and payload["stats"]["node_count"] == 0:
        for win in settings.graph3d.fallback_windows:
            payload = export_graph_json(db, ln, le, win)
            if payload["stats"]["edge_count"] > 0:
                payload["stats"]["fallback_used"] = win
                break
    return payload

@app.get("/graph3d/settings")
def graph3d_settings():
    """Return current tunable defaults and fallbacks for debugging/UI."""
    return {
        "default_window": settings.graph3d.default_window,
        "default_nodes": settings.graph3d.default_nodes,
        "default_edges": settings.graph3d.default_edges,
        "max_nodes": settings.graph3d.max_nodes,
        "max_edges": settings.graph3d.max_edges,
        "fallback_windows": settings.graph3d.fallback_windows,
    }

# ---------------- Jinja setup ----------------
from fastapi.templating import Jinja2Templates
import pathlib
templates = Jinja2Templates(directory=str(pathlib.Path(__file__).parent / "templates"))

@app.get("/graph3d/view")
def graph3d_view(
    request: Request,
    w: int = Query(settings.graph3d.default_window, alias="w", ge=1),
    ln: int = Query(settings.graph3d.default_nodes, alias="ln", ge=1),
    le: int = Query(settings.graph3d.default_edges, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    payload = export_graph_json(db, ln, le, w)
    return templates.TemplateResponse("graph3d.html", {"request": request, "data": payload})

@app.post("/pipeline/trigger/{worker_name}", status_code=202)
def trigger_worker(worker_name: str, db=Depends(get_db)):
    """Trigger a specific worker manually"""
    topic_map = {
        "nlp_extract": settings.kafka.ingest_topic,
        "linker_worker": settings.kafka.candidates_topic,
        "layout_worker": settings.kafka.graph_events_topic,
        "tag_suggester": settings.kafka.candidates_topic,
        "curation_worker": settings.kafka.curation_topic
    }

    if worker_name not in topic_map:
        raise HTTPException(status_code=400, detail=f"Unknown worker: {worker_name}")

    # Trigger the worker by sending a test message
    triggered = produce(
        topic_map[worker_name],
        {"type": "manual_trigger", "timestamp": datetime.utcnow().isoformat()},
    )
    if not triggered:
        raise HTTPException(status_code=503, detail="Kafka producer unavailable")

    return {
        "status": "triggered",
        "worker": worker_name,
        "topic": topic_map[worker_name],
    }

@app.get("/graph/stats")
def get_graph_stats(db=Depends(get_db)):
    """Get detailed graph statistics"""
    stats = db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM nodes WHERE kind='message') as message_count,
            (SELECT COUNT(*) FROM nodes WHERE kind='glyph') as glyph_count,
            (SELECT COUNT(*) FROM edges) as edge_count,
            (SELECT AVG(degree) FROM (
                SELECT COUNT(*) as degree FROM edges GROUP BY src_id
            ) t) as avg_degree
    """)).first()

    if stats is None:
        return {
            "message_count": 0,
            "glyph_count": 0,
            "edge_count": 0,
            "avg_degree": 0.0,
        }

    message_count, glyph_count, edge_count, avg_degree = stats
    return {
        "message_count": message_count or 0,
        "glyph_count": glyph_count or 0,
        "edge_count": edge_count or 0,
        "avg_degree": float(avg_degree or 0),
    }
=======
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncGenerator, List

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, start_http_server
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import embeddings, health, nodes, overview, settings
from app.core.config import Settings, get_settings
from app.core.database import DatabaseHealthResult, database_manager
from app.core.messaging import MessageQueueHealthResult, message_queue_manager
from app.services.quantum_service import quantum_registry
from app.utils.logging import get_logger, setup_logging
from app.utils.metrics import active_connections_gauge, request_count_counter, request_duration_histogram

logger = logging.getLogger(__name__)


@dataclass
class StartupHealthStatus:
    all_systems_operational: bool
    failed_components: List[str]
    database: DatabaseHealthResult
    message_queue: MessageQueueHealthResult


class QuantumTelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        quantum_correlation_id = request.headers.get("X-Quantum-Correlation-ID")
        active_connections_gauge.inc()
        try:
            response = await call_next(request)
        except Exception as exc:  # pragma: no cover
            logger.exception("Unhandled exception")
            response = JSONResponse(status_code=500, content={"detail": "internal_error"})
        finally:
            duration = time.perf_counter() - start_time
            request_duration_histogram.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code,
                quantum_enabled=bool(quantum_correlation_id),
            ).observe(duration)
            request_count_counter.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code,
            ).inc()
            response.headers["X-Response-Time"] = f"{duration:.6f}"
            if quantum_correlation_id:
                response.headers["X-Quantum-Correlation-ID"] = quantum_correlation_id
            active_connections_gauge.dec()
        return response


async def perform_startup_health_check() -> StartupHealthStatus:
    database_status = await database_manager.health_check()
    message_queue_status = await message_queue_manager.health_check()
    failed = []
    if not database_status.is_healthy:
        failed.append("database")
    if not message_queue_status.is_healthy:
        failed.append("message_queue")
    return StartupHealthStatus(
        all_systems_operational=not failed,
        failed_components=failed,
        database=database_status,
        message_queue=message_queue_status,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    setup_logging(settings.log_level, settings.features.enable_quantum_features)
    logger = get_logger(__name__)
    logger.info("Starting %s v%s", settings.service_name, settings.service_version)

    await database_manager.initialize_connection_pool(
        database_url=settings.database.url,
        pool_size=settings.database.pool_size,
        max_overflow=settings.database.max_overflow,
        pool_timeout=settings.database.pool_timeout,
        pool_recycle=settings.database.pool_recycle,
        quantum_coherence_enabled=settings.features.enable_quantum_features,
    )

    await message_queue_manager.initialize(settings.kafka.brokers, settings.features.enable_quantum_messaging)

    if settings.features.enable_quantum_features:
        await quantum_registry.initialize_quantum_backends()

    start_http_server(settings.telemetry.prometheus_port)

    health_status = await perform_startup_health_check()
    if not health_status.all_systems_operational:
        logger.error("Startup health check failed: %s", ", ".join(health_status.failed_components))
        raise RuntimeError("Service failed health checks")

    yield

    if settings.features.enable_quantum_features:
        await quantum_registry.preserve_quantum_states()
    await message_queue_manager.shutdown()
    await database_manager.close_all_connections()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.service_name,
        version=settings.service_version,
        lifespan=lifespan,
        docs_url="/docs" if settings.features.enable_docs else None,
        redoc_url="/redoc" if settings.features.enable_docs else None,
    )

    if settings.security.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.security.cors_allow_origins],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(QuantumTelemetryMiddleware)

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(overview.router, prefix="/api/v1")
    app.include_router(nodes.router, prefix="/api/v1")
    app.include_router(settings.router, prefix="/api/v1")
    app.include_router(embeddings.router, prefix="/api/v1")

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "service": settings.service_name,
            "version": settings.service_version,
            "health": "/api/v1/healthz",
            "metrics": "/metrics",
        }

    return app


app = create_app()


__all__ = ["app", "create_app"]

