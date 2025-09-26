"""Shared API dependencies."""
from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.database import get_database_session


async def get_settings_dependency() -> Settings:
    return get_settings()


def get_db_session_dependency(session=Depends(get_database_session)):
    return session


__all__ = ["get_settings_dependency", "get_db_session_dependency"]
