"""Seed database with sample data."""
from __future__ import annotations

import asyncio

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.models.nodes import Node
from app.models.settings import SettingEntry
from app.models.base import Base


async def main() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database.url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            insert(Node).values(
                [
                    {"name": "orchestrator", "status": "online", "healthy": True},
                    {"name": "embedding-worker", "status": "online", "healthy": True},
                ]
            ).on_conflict_do_nothing(index_elements=[Node.name])
        )
        await conn.execute(
            insert(SettingEntry).values(
                [
                    {"key": "telemetry.retention_days", "value": "7"},
                ]
            ).on_conflict_do_nothing(index_elements=[SettingEntry.key])
        )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
