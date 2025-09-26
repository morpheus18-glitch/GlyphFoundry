"""Database models for compute nodes."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class Node(Base):
    """Registered worker node with telemetry metadata."""

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String(128), unique=True, nullable=False)
    status: str = Column(String(32), nullable=False, default="offline")
    healthy: bool = Column(Boolean, nullable=False, default=False)
    cpu_usage: float = Column(Float, nullable=False, default=0.0)
    memory_usage: float = Column(Float, nullable=False, default=0.0)
    labels: Optional[dict] = Column(JSONB, nullable=True)
    last_heartbeat: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


__all__ = ["Node"]
