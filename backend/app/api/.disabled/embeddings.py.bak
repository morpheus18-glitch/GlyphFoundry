"""Embedding endpoints."""
from fastapi import APIRouter, Depends

from app.api.deps import get_db_session_dependency
from app.core.config import get_settings
from app.schemas.embeddings import EmbeddingRequest, EmbeddingResponse
from app.services.embedding_service import EmbeddingService

router = APIRouter()


@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(payload: EmbeddingRequest, session=Depends(get_db_session_dependency)):
    settings = get_settings()
    service = EmbeddingService(session, model_name=settings.service_name)
    records = await service.embed_texts(payload.texts)
    return EmbeddingResponse(
        embeddings_count=len(records),
        embeddings=[
            {
                "content_hash": record.content_hash,
                "vector": record.vector,
                "model_name": record.model_name,
                "created_at": record.created_at.isoformat(),
            }
            for record in records
        ],
        model_name=settings.service_name,
        quantum_enhanced=settings.features.enable_quantum_features,
    )
