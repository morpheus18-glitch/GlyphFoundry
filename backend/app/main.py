"""Glyph Foundry FastAPI application entrypoint."""
from __future__ import annotations

import importlib
import logging
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import JSONResponse, PlainTextResponse

from db import get_db, session_scope
from exports import export_graph_json, export_tags_json
from kafka_bus import produce
from settings import settings

try:
    from logging_config import configure_logging
except Exception:
    def configure_logging(*_args, **_kwargs):
        """Fallback logging configuration used during local development."""
        logging.basicConfig(level=logging.INFO)

try:
    from ensure_schema import ensure_min_schema
except Exception:
    ensure_min_schema = None  # type: ignore[assignment]

configure_logging("INFO")
app = FastAPI(title="Glyph Foundry API", version="1.0.0")

try:
    from routes import router as api_router  # type: ignore
except Exception:  # pragma: no cover - optional package wiring
    api_router = None

if api_router is not None:
    app.include_router(api_router)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _try_include_routers() -> None:
    """Best-effort discovery of additional routers shipped alongside the app."""

    candidates = [
        ("routes", ["router", "api", "app_router"]),
        ("api", ["router", "api", "app_router"]),
        ("endpoints", ["router", "api", "app_router"]),
    ]
    for mod_name, attrs in candidates:
        try:
            module = importlib.import_module(mod_name)
        except Exception:
            continue
        for attr in attrs:
            router = getattr(module, attr, None)
            if router is None or router is api_router:
                continue
            try:
                app.include_router(router)
                logging.getLogger(__name__).info("Included router: %s.%s", mod_name, attr)
            except Exception as exc:  # pragma: no cover - logging only
                logging.getLogger(__name__).warning(
                    "Failed to include router %s.%s: %s", mod_name, attr, exc
                )


_try_include_routers()


@app.on_event("startup")
def _startup() -> None:
    """Perform lightweight startup checks without blocking service readiness."""

    if ensure_min_schema is not None:
        try:
            with session_scope() as db:
                ensure_min_schema(db)
        except Exception as exc:  # pragma: no cover - defensive logging
            logging.getLogger(__name__).warning("ensure_min_schema skipped: %s", exc)


@app.get("/healthz", response_class=PlainTextResponse)
def healthz() -> str:
    return "ok"


@app.exception_handler(Exception)
async def unhandled_exc(_: Request, exc: Exception) -> JSONResponse:
    """Return structured JSON for unexpected errors."""

    return JSONResponse(status_code=500, content={"error": "internal", "detail": str(exc)})


@app.get("/graph3d/data")
def graph3d_data(
    w: int = Query(settings.graph3d.default_window, alias="w", ge=1),
    ln: int = Query(settings.graph3d.default_nodes, alias="ln", ge=1),
    le: int = Query(settings.graph3d.default_edges, alias="le", ge=1),
    db: Session = Depends(get_db),
):
    """Return graph payload with sane clamps and fallback windows."""

    ln = min(ln, settings.graph3d.max_nodes)
    le = min(le, settings.graph3d.max_edges)

    payload = export_graph_json(db, ln, le, w)
    stats = payload.get("stats", {})
    if stats.get("edge_count") == 0 and stats.get("node_count") == 0:
        for win in settings.graph3d.fallback_windows:
            payload = export_graph_json(db, ln, le, win)
            stats = payload.get("stats", {})
            if stats.get("edge_count", 0) > 0:
                stats["fallback_used"] = win
                break
    return payload


@app.get("/tags/data")
def tags_data(db: Session = Depends(get_db)):
    return export_tags_json(db)


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


templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "templates"))


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
def trigger_worker(worker_name: str, db: Session = Depends(get_db)):
    """Trigger a specific worker manually"""

    topic_map = {
        "nlp_extract": settings.kafka.ingest_topic,
        "linker_worker": settings.kafka.candidates_topic,
        "layout_worker": settings.kafka.graph_events_topic,
        "tag_suggester": settings.kafka.candidates_topic,
        "curation_worker": settings.kafka.curation_topic,
    }

    if worker_name not in topic_map:
        raise HTTPException(status_code=400, detail=f"Unknown worker: {worker_name}")

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
def get_graph_stats(db: Session = Depends(get_db)):
    """Get detailed graph statistics"""

    stats = db.execute(
        text(
            """
        SELECT
            (SELECT COUNT(*) FROM nodes WHERE kind='message') as message_count,
            (SELECT COUNT(*) FROM nodes WHERE kind='glyph') as glyph_count,
            (SELECT COUNT(*) FROM edges) as edge_count,
            (SELECT AVG(degree) FROM (
                SELECT COUNT(*) as degree FROM edges GROUP BY src_id
            ) t) as avg_degree
    """
        )
    ).first()

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


__all__ = ["app"]
