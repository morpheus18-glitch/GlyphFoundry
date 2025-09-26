"""Database connectivity and health management."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from typing import AsyncGenerator, Generator, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.models.base import Base

logger = logging.getLogger(__name__)


@dataclass
class DatabaseHealthResult:
    is_healthy: bool
    details: dict
    quantum_features_available: bool


class DatabaseManager:
    """Centralized manager for SQLAlchemy engines and sessions."""

    def __init__(self) -> None:
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[sessionmaker] = None

    async def initialize_connection_pool(
        self,
        database_url: str,
        pool_size: int,
        max_overflow: int,
        quantum_coherence_enabled: bool,
        **kwargs,
    ) -> None:
        if self._engine is not None:
            return

        connect_args = {"server_settings": {"jit": "off"}} if quantum_coherence_enabled else {}
        self._engine = create_async_engine(
            database_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=kwargs.get("pool_timeout", 30),
            pool_recycle=kwargs.get("pool_recycle", 1800),
            echo=kwargs.get("echo", False),
            connect_args=connect_args,
        )
        self._session_factory = sessionmaker(self._engine, expire_on_commit=False, class_=AsyncSession)

        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema synchronized")

    async def close_all_connections(self) -> None:
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None

    @contextmanager
    def sync_session_scope(self) -> Generator[Session, None, None]:
        from sqlalchemy import create_engine

        settings = get_settings()
        engine = create_engine(settings.database.url)
        try:
            with engine.connect() as connection:
                yield Session(bind=connection)
        finally:
            engine.dispose()

    @asynccontextmanager
    async def session_scope(self) -> AsyncGenerator[AsyncSession, None]:
        if self._session_factory is None:
            raise RuntimeError("DatabaseManager has not been initialized")
        session = self._session_factory()
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def health_check(self) -> DatabaseHealthResult:
        if self._engine is None:
            return DatabaseHealthResult(False, {"error": "engine_not_initialized"}, False)

        try:
            async with self._engine.connect() as connection:
                result = await connection.execute(text("SELECT 1"))
                value = result.scalar()
                return DatabaseHealthResult(
                    is_healthy=value == 1,
                    details={"result": value},
                    quantum_features_available=False,
                )
        except Exception as exc:  # pragma: no cover
            logger.exception("Database health check failed")
            return DatabaseHealthResult(False, {"error": str(exc)}, False)

    def get_session_factory(self) -> sessionmaker:
        if self._session_factory is None:
            raise RuntimeError("DatabaseManager has not been initialized")
        return self._session_factory


database_manager = DatabaseManager()


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    async with database_manager.session_scope() as session:
        yield session


__all__ = [
    "DatabaseManager",
    "DatabaseHealthResult",
    "database_manager",
    "get_database_session",
]
