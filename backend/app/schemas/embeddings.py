"""Embeddings API schemas."""
from typing import List

from pydantic import BaseModel, Field

from app.schemas.base import ORMModel


class EmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1)


class EmbeddingVector(BaseModel):
    content_hash: str
    vector: List[float]
    model_name: str
    created_at: str


class EmbeddingResponse(BaseModel):
    embeddings_count: int
    embeddings: List[EmbeddingVector]
    model_name: str
    quantum_enhanced: bool


class EmbeddingRecordRead(ORMModel):
    id: int
    content_hash: str
    text_preview: str
    vector: List[float]
    model_name: str
    created_at: str
