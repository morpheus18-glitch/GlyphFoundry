"""Cleanup tasks for embeddings."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from redis import asyncio as aioredis


async def purge_expired_embeddings(redis: Optional[aioredis.Redis], ttl_seconds: int = 3600) -> None:
    if redis is None:
        return
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=ttl_seconds)
    keys = await redis.keys("embedding:cache:*")
    for key in keys:
        raw = await redis.get(key)
        if raw is None:
            continue
        payload = json.loads(raw)
        created_at = datetime.fromisoformat(payload.get("created_at"))
        if created_at < cutoff:
            await redis.delete(key)
