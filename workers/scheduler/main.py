"""Scheduler worker managing recurring jobs."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Awaitable, Callable, Dict

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from workers.scheduler.jobs.health_check import emit_health_checks
from workers.scheduler.jobs.cleanup import purge_expired_embeddings
from workers.shared.base_worker import BaseWorker, WorkerMessage


class SchedulerWorker(BaseWorker):
    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        super().__init__(worker_type="scheduler", redis_url=redis_url, max_concurrent_jobs=4)
        self._scheduler = AsyncIOScheduler()
        self._tasks: Dict[str, Callable[[], Awaitable[None]]] = {}

    async def on_startup(self) -> None:
        self._tasks = {
            "health_check": lambda: emit_health_checks(self._redis),
            "purge_embeddings": lambda: purge_expired_embeddings(self._redis),
        }
        for job_id, task in self._tasks.items():
            self._scheduler.add_job(task, "interval", seconds=60, id=job_id, replace_existing=True)
        self._scheduler.start()

    async def fetch_job(self) -> WorkerMessage | None:
        await asyncio.sleep(60)
        return None

    async def handle_job(self, message: WorkerMessage) -> None:
        # No-op, jobs are triggered directly by APScheduler
        return


async def main() -> None:
    worker = SchedulerWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
