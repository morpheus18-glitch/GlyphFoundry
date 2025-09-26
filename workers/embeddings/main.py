"""Embeddings worker implementation."""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Optional

from redis import asyncio as aioredis

from workers.shared.base_worker import BaseWorker, WorkerMessage


@dataclass
class QueueMessage:
    correlation_id: str
    message_type: str
    payload: dict


class RedisEmbeddingWorker(BaseWorker):
    queue_key = "queue:embeddings"

    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        super().__init__(worker_type="embeddings", redis_url=redis_url, max_concurrent_jobs=8)
        self._queue: Optional[aioredis.Redis] = None

    async def on_startup(self) -> None:
        self._queue = aioredis.Redis.from_url(self.redis_url, decode_responses=True)

    async def fetch_job(self) -> Optional[WorkerMessage]:
        if not self._queue:
            return None
        data = await self._queue.lpop(self.queue_key)
        if data is None:
            await asyncio.sleep(0.25)
            return None
        payload = json.loads(data)
        return QueueMessage(
            correlation_id=payload.get("correlation_id", payload.get("job_id", "")),
            message_type=payload.get("message_type", "embedding"),
            payload=payload,
        )

    async def handle_job(self, message: WorkerMessage) -> None:
        text = message.payload.get("text")
        if not text:
            return
        # Simulate embedding generation latency
        await asyncio.sleep(0.05)


async def main() -> None:
    worker = RedisEmbeddingWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
