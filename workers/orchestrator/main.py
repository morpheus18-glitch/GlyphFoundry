"""Orchestrator worker for node health monitoring."""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional

from kafka import KafkaProducer
from redis import asyncio as aioredis

from workers.shared.base_worker import BaseWorker, WorkerMessage


@dataclass
class OrchestratorJob:
    correlation_id: str
    message_type: str
    payload: Dict[str, str]


@dataclass
class HealthSnapshot:
    worker_id: str
    status: str
    metrics: Dict[str, float]


class OrchestratorWorker(BaseWorker):
    def __init__(
        self,
        kafka_bootstrap: str = "localhost:9092",
        redis_url: str = "redis://localhost:6379/0",
        state_topic: str = "quantum.state",
    ) -> None:
        super().__init__(worker_type="orchestrator", redis_url=redis_url, max_concurrent_jobs=1)
        self._kafka_bootstrap = kafka_bootstrap
        self._state_topic = state_topic
        self._producer: Optional[KafkaProducer] = None

    async def on_startup(self) -> None:
        self._producer = KafkaProducer(bootstrap_servers=[self._kafka_bootstrap])
        self._redis = aioredis.Redis.from_url(self.redis_url, decode_responses=True)

    async def fetch_job(self) -> Optional[WorkerMessage]:
        await asyncio.sleep(5)
        return OrchestratorJob(
            correlation_id="orchestrator",
            message_type="health",
            payload={"generated_at": datetime.now(timezone.utc).isoformat()},
        )

    async def handle_job(self, message: WorkerMessage) -> None:
        if not self._redis:
            return
        registry = await self._redis.hgetall("worker:heartbeat")
        snapshots = []
        for worker_id, raw in registry.items():
            data = json.loads(raw)
            snapshots.append(
                HealthSnapshot(
                    worker_id=worker_id,
                    status=data.get("status", "unknown"),
                    metrics={
                        "cpu": data.get("cpu", 0.0),
                        "memory": data.get("memory", 0.0),
                        "jobs_processed": data.get("jobs_processed", 0),
                    },
                )
            )
        if self._producer and snapshots:
            payload = {
                "snapshots": [snapshot.__dict__ for snapshot in snapshots],
                "generated_at": message.payload.get("generated_at"),
            }
            self._producer.send(self._state_topic, json.dumps(payload).encode("utf-8"))
            self._producer.flush()


async def main() -> None:
    worker = OrchestratorWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
