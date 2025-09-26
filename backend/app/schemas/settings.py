"""Configuration schemas."""
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import ORMModel


class SettingCreate(BaseModel):
    key: str = Field(..., max_length=128)
    value: str
    description: Optional[str] = None


class SettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None


class SettingRead(ORMModel):
    id: int
    key: str
    value: str
    description: Optional[str]
    updated_at: str
