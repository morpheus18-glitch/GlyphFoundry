"""Base worker implementation with observability and Redis coordination."""
from __future__ import annotations

import asyncio
import json
import logging
import signal
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional, Protocol, TypeVar

import psutil
from prometheus_client import Counter, Gauge, Histogram
from redis import asyncio as aioredis

T = TypeVar("T")

logger = logging.getLogger(__name__)


class WorkerStatus(str):
    INITIALIZING = "initializing"
    HEALTHY = "healthy"
    PROCESSING = "processing"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    SHUTTING_DOWN = "shutting_down"


class WorkerMessage(Protocol):
    correlation_id: str
    message_type: str
    payload: Dict[str, Any]


@dataclass
class WorkerMetrics:
    worker_id: str
    worker_type: str
    jobs_processed: int = 0
    jobs_failed: int = 0
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)


class BaseWorker(ABC):
    """Asynchronous worker foundation with Redis coordination."""

    def __init__(
        self,
        worker_type: str,
        redis_url: str = "redis://localhost:6379/0",
        max_concurrent_jobs: int = 4,
        heartbeat_interval: int = 30,
    ) -> None:
        self.worker_type = worker_type
        self.worker_id = f"{worker_type}-{uuid.uuid4().hex[:8]}"
        self.redis_url = redis_url
        self.max_concurrent_jobs = max_concurrent_jobs
        self.heartbeat_interval = heartbeat_interval

        self._status: str = WorkerStatus.INITIALIZING
        self._job_semaphore = asyncio.Semaphore(max_concurrent_jobs)
        self._active_jobs: Dict[str, datetime] = {}
        self._redis: Optional[aioredis.Redis] = None
        self._shutdown_event = asyncio.Event()
        self.metrics = WorkerMetrics(worker_id=self.worker_id, worker_type=self.worker_type)

        self._jobs_processed_counter = Counter(
            "quantum_worker_jobs_total",
            "Jobs processed by worker",
            labelnames=("worker_type", "status"),
        )
        self._job_duration_histogram = Histogram(
            "quantum_worker_job_duration_seconds",
            "Job execution time",
            labelnames=("worker_type",),
        )
        self._active_jobs_gauge = Gauge(
            "quantum_worker_active_jobs",
            "Active jobs",
            labelnames=("worker_type",),
        )

    async def start(self) -> None:
        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)
        await self._initialize()
        await self._run_event_loop()

    async def shutdown(self) -> None:
        self._shutdown_event.set()
        if self._redis:
            await self._redis.aclose()
        logger.info("Worker %s shut down", self.worker_id)

    async def _initialize(self) -> None:
        self._redis = aioredis.Redis.from_url(self.redis_url, decode_responses=True)
        await self._redis.ping()
        await self._register_worker()
        await self._update_status(WorkerStatus.HEALTHY)
        await self.on_startup()
        logger.info("Worker %s initialized", self.worker_id)

    async def _run_event_loop(self) -> None:
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        processing_task = asyncio.create_task(self._processing_loop())
        await asyncio.wait(
            [heartbeat_task, processing_task],
            return_when=asyncio.ALL_COMPLETED,
        )

    async def _processing_loop(self) -> None:
        while not self._shutdown_event.is_set():
            message = await self.fetch_job()
            if message is None:
                await asyncio.sleep(0.1)
                continue
            await self._job_semaphore.acquire()
            asyncio.create_task(self._execute_job(message))

    async def _execute_job(self, message: WorkerMessage) -> None:
        start = time.perf_counter()
        job_id = getattr(message, "correlation_id", uuid.uuid4().hex)
        self._active_jobs[job_id] = datetime.utcnow()
        self._active_jobs_gauge.labels(self.worker_type).set(len(self._active_jobs))
        try:
            await self.handle_job(message)
            self.metrics.jobs_processed += 1
            self._jobs_processed_counter.labels(worker_type=self.worker_type, status="success").inc()
        except Exception as exc:  # pragma: no cover
            logger.exception("Job failed", exc_info=exc)
            self.metrics.jobs_failed += 1
            self._jobs_processed_counter.labels(worker_type=self.worker_type, status="error").inc()
        finally:
            duration = time.perf_counter() - start
            self._job_duration_histogram.labels(worker_type=self.worker_type).observe(duration)
            self._active_jobs.pop(job_id, None)
            self._active_jobs_gauge.labels(self.worker_type).set(len(self._active_jobs))
            self._job_semaphore.release()

    async def _heartbeat_loop(self) -> None:
        while not self._shutdown_event.is_set():
            await self._send_heartbeat()
            await asyncio.sleep(self.heartbeat_interval)

    async def _send_heartbeat(self) -> None:
        if not self._redis:
            return
        payload = {
            "worker_id": self.worker_id,
            "worker_type": self.worker_type,
            "status": self._status,
            "timestamp": datetime.utcnow().isoformat(),
            "jobs_processed": self.metrics.jobs_processed,
            "jobs_failed": self.metrics.jobs_failed,
            "cpu": psutil.cpu_percent(),
            "memory": psutil.virtual_memory().percent,
        }
        await self._redis.setex(
            name=f"worker:heartbeat:{self.worker_id}",
            time=self.heartbeat_interval * 3,
            value=json.dumps(payload),
        )

    async def _register_worker(self) -> None:
        if not self._redis:
            return
        await self._redis.hset(
            "worker:registry",
            mapping={
                self.worker_id: json.dumps(
                    {
                        "worker_type": self.worker_type,
                        "registered_at": datetime.utcnow().isoformat(),
                    }
                )
            },
        )

    async def _update_status(self, status: str) -> None:
        self._status = status
        if self._redis:
            await self._redis.hset(
                "worker:status",
                self.worker_id,
                json.dumps({"status": status, "updated_at": datetime.utcnow().isoformat()}),
            )

    def _handle_signal(self, signum, frame) -> None:  # pragma: no cover
        logger.info("Received signal %s", signum)
        self._shutdown_event.set()

    @abstractmethod
    async def handle_job(self, message: WorkerMessage) -> None:
        """Process an individual job."""

    @abstractmethod
    async def fetch_job(self) -> Optional[WorkerMessage]:
        """Retrieve the next job from the queue."""

    async def on_startup(self) -> None:
        """Hook for worker-specific initialization."""


__all__ = ["BaseWorker", "WorkerStatus", "WorkerMetrics"]
