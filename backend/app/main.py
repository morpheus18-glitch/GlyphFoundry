"""Quantum Nexus FastAPI application."""
from __future__ import annotations

import logging
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
