"""Configuration persistence model."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.models.base import Base


class SettingEntry(Base):
    """Key-value configuration with history."""

    id: int = Column(Integer, primary_key=True)
    key: str = Column(String(128), unique=True, nullable=False, index=True)
    value: str = Column(Text, nullable=False)
    description: str = Column(Text, nullable=True)
    updated_at: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


__all__ = ["SettingEntry"]
