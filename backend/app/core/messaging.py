"""Kafka messaging integration."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional

from kafka import KafkaAdminClient, KafkaProducer
from kafka.errors import KafkaError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class MessageQueueHealthResult:
    is_healthy: bool
    details: Dict[str, Any]
    quantum_channels_available: bool


class MessageQueueManager:
    def __init__(self) -> None:
        self._producer: Optional[KafkaProducer] = None
        self._admin: Optional[KafkaAdminClient] = None

    async def initialize(self, broker_url: Iterable[str] | str, enable_quantum_channels: bool) -> None:
        brokers = [broker_url] if isinstance(broker_url, str) else list(broker_url)
        if self._producer:
            return
        self._producer = KafkaProducer(
            bootstrap_servers=brokers,
            client_id=get_settings().kafka.client_id,
            value_serializer=lambda value: value if isinstance(value, bytes) else str(value).encode("utf-8"),
            linger_ms=5,
            enable_idempotence=get_settings().kafka.enable_idempotence,
        )
        self._admin = KafkaAdminClient(bootstrap_servers=brokers, client_id=f"{get_settings().kafka.client_id}-admin")
        if enable_quantum_channels:
            await self._ensure_topics(get_settings().kafka.state_topic)
        logger.info("Kafka producer initialized")

    async def publish(self, topic: str, value: Any, headers: Optional[Dict[str, str]] = None) -> None:
        if not self._producer:
            raise RuntimeError("MessageQueueManager is not initialized")
        future = self._producer.send(
            topic,
            value=value,
            headers=[(key, header.encode("utf-8")) for key, header in (headers or {}).items()],
        )
        try:
            future.get(timeout=5)
        except KafkaError as exc:
            logger.error("Failed to publish message", exc_info=exc)
            raise

    async def shutdown(self) -> None:
        if self._producer:
            self._producer.flush()
            self._producer.close()
            self._producer = None
        if self._admin:
            self._admin.close()
            self._admin = None

    async def health_check(self) -> MessageQueueHealthResult:
        if self._producer is None:
            return MessageQueueHealthResult(False, {"error": "producer_not_initialized"}, False)
        try:
            metadata = self._producer.metrics()
            return MessageQueueHealthResult(True, {"metrics": metadata}, False)
        except KafkaError as exc:  # pragma: no cover
            logger.exception("Kafka health check failed")
            return MessageQueueHealthResult(False, {"error": str(exc)}, False)

    async def _ensure_topics(self, *topics: str) -> None:
        if not self._admin:
            return
        existing = self._admin.list_topics()
        missing = [topic for topic in topics if topic not in existing]
        if not missing:
            return
        from kafka.admin import NewTopic

        new_topics = [NewTopic(name=topic, num_partitions=1, replication_factor=1) for topic in missing]
        self._admin.create_topics(new_topics=new_topics, validate_only=False)
        logger.info("Created Kafka topics: %s", ", ".join(missing))


message_queue_manager = MessageQueueManager()


__all__ = ["message_queue_manager", "MessageQueueHealthResult", "MessageQueueManager"]
