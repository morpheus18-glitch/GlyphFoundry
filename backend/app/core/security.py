"""Security helpers for API key authentication."""
from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import get_settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_api_key(api_key: str | None = Security(_api_key_header)) -> str | None:
    settings = get_settings()
    if not settings.security.api_keys:
        return None
    if api_key not in settings.security.api_keys:
        raise HTTPException(status_code=401, detail="invalid_api_key")
    return api_key


def require_api_key(api_key: str | None = Depends(get_api_key)) -> None:
    if api_key is None:
        raise HTTPException(status_code=403, detail="missing_api_key")


__all__ = ["require_api_key", "get_api_key"]
