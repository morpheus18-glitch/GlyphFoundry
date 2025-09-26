"""Overview endpoints."""
from fastapi import APIRouter, Depends

from app.api.deps import get_db_session_dependency
from app.schemas.nodes import NodeHealthSummary
from app.services.node_service import NodeService
from app.services.telemetry_service import telemetry_service

router = APIRouter()


@router.get("/overview", response_model=NodeHealthSummary)
async def get_overview(session=Depends(get_db_session_dependency)):
    service = NodeService(session)
    summary = await service.summarize_health()
    # attach service version via response headers or metrics if necessary
    return summary


@router.get("/telemetry")
async def get_telemetry():
    return telemetry_service.capture_metrics()
