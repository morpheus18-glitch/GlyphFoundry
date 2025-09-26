"""Runs pending migrations sequentially."""
from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings


async def run_migrations(engine, migrations_dir: Path) -> None:
    async with engine.begin() as conn:
        for migration in sorted(migrations_dir.glob("*.sql")):
            await conn.execute(text(migration.read_text()))


async def main() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database.url)
    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    await run_migrations(engine, migrations_dir)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
