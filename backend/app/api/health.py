"""Health endpoints."""
from fastapi import APIRouter

from app.core.database import database_manager
from app.core.messaging import message_queue_manager

router = APIRouter()


@router.get("/healthz", tags=["health"])
async def healthz():
    db_status = await database_manager.health_check()
    mq_status = await message_queue_manager.health_check()
    healthy = db_status.is_healthy and mq_status.is_healthy
    return {
        "status": "ok" if healthy else "degraded",
        "database": db_status.details,
        "message_queue": mq_status.details,
    }


@router.get("/readiness", tags=["health"])
async def readiness():
    status = await database_manager.health_check()
    return {"ready": status.is_healthy, "database": status.details}
