"""Embedding storage model."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY

from app.models.base import Base


class EmbeddingRecord(Base):
    """Stores deterministic embeddings for content."""

    id: int = Column(Integer, primary_key=True)
    content_hash: str = Column(String(128), unique=True, nullable=False, index=True)
    text_preview: str = Column(String(512), nullable=False)
    vector: list[float] = Column(ARRAY(Float), nullable=False)
    model_name: str = Column(String(128), nullable=False)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


__all__ = ["EmbeddingRecord"]
