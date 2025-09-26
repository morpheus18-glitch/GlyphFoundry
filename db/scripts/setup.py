"""Database setup script."""
from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings


async def apply_sql_file(engine, path: Path) -> None:
    async with engine.begin() as conn:
        sql = path.read_text()
        await conn.execute(text(sql))


async def main() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database.url)
    migrations = sorted(Path(__file__).resolve().parent.parent.joinpath("migrations").glob("*.sql"))
    for path in migrations:
        await apply_sql_file(engine, path)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
