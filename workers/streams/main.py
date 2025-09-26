"""Streaming bridge worker between Kafka clusters."""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Dict, Optional

from kafka import KafkaConsumer, KafkaProducer

from workers.shared.base_worker import BaseWorker, WorkerMessage


@dataclass
class StreamJob:
    correlation_id: str
    message_type: str
    payload: Dict[str, str]


class StreamBridgeWorker(BaseWorker):
    def __init__(
        self,
        source_topic: str = "quantum.ingest",
        target_topic: str = "quantum.state",
        bootstrap_servers: str = "localhost:9092",
    ) -> None:
        super().__init__(worker_type="stream-bridge", redis_url="redis://localhost:6379/0", max_concurrent_jobs=2)
        self._consumer: Optional[KafkaConsumer] = None
        self._producer: Optional[KafkaProducer] = None
        self._source_topic = source_topic
        self._target_topic = target_topic
        self._bootstrap = bootstrap_servers

    async def on_startup(self) -> None:
        self._consumer = KafkaConsumer(
            self._source_topic,
            bootstrap_servers=[self._bootstrap],
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )
        self._producer = KafkaProducer(
            bootstrap_servers=[self._bootstrap],
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )

    async def fetch_job(self) -> Optional[WorkerMessage]:
        if not self._consumer:
            await asyncio.sleep(0.5)
            return None
        message = await asyncio.get_event_loop().run_in_executor(None, self._consumer.poll, 1.0)
        if not message:
            return None
        for records in message.values():
            for record in records:
                return StreamJob(
                    correlation_id=str(record.offset),
                    message_type="stream", 
                    payload={"value": json.dumps(record.value)},
                )
        return None

    async def handle_job(self, message: WorkerMessage) -> None:
        if not self._producer:
            return
        payload = json.loads(message.payload.get("value", "{}"))
        payload["bridged"] = True
        self._producer.send(self._target_topic, payload)
        self._producer.flush()


async def main() -> None:
    worker = StreamBridgeWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
