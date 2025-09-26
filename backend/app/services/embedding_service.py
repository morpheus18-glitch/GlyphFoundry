"""Embeddings business logic."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Iterable, List

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.embeddings import EmbeddingRecord


class EmbeddingService:
    """Provides deterministic embeddings and persistence."""

    def __init__(self, session: AsyncSession, model_name: str = "text-embedding-3-small") -> None:
        self._session = session
        self._model_name = model_name

    async def embed_texts(self, texts: Iterable[str]) -> List[EmbeddingRecord]:
        records: List[EmbeddingRecord] = []
        for text in texts:
            text = text.strip()
            if not text:
                continue
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            existing = await self._get_by_hash(content_hash)
            if existing is not None:
                records.append(existing)
                continue
            vector = self._generate_vector(text)
            record = EmbeddingRecord(
                content_hash=content_hash,
                text_preview=text[:512],
                vector=vector,
                model_name=self._model_name,
                created_at=datetime.now(timezone.utc),
            )
            self._session.add(record)
            await self._session.flush()
            records.append(record)
        return records

    async def list_embeddings(self) -> List[EmbeddingRecord]:
        result = await self._session.execute(select(EmbeddingRecord).order_by(EmbeddingRecord.created_at.desc()))
        return result.scalars().all()

    async def _get_by_hash(self, content_hash: str) -> EmbeddingRecord | None:
        result = await self._session.execute(select(EmbeddingRecord).where(EmbeddingRecord.content_hash == content_hash))
        return result.scalar_one_or_none()

    def _generate_vector(self, text: str) -> List[float]:
        hash_int = int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16)
        rng = np.random.default_rng(hash_int % (2**32))
        vector = rng.normal(0, 1, 256)
        vector = vector / np.linalg.norm(vector)
        return vector.astype(float).tolist()


__all__ = ["EmbeddingService"]
