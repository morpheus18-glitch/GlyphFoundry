"""Periodic worker health checks."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from redis import asyncio as aioredis


async def emit_health_checks(redis: Optional[aioredis.Redis]) -> None:
    if redis is None:
        return
    registry = await redis.hgetall("worker:registry")
    for worker_id in registry:
        await redis.publish(
            "channel:health",
            json.dumps({
                "worker_id": worker_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "ping",
            }),
        )
