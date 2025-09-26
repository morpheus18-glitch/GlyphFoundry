from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health", tags=["health"])
@router.get("/healthz", tags=["health"])
def health():
    return {
        "status": "ok",
        "ts": datetime.utcnow().isoformat() + "Z"
    }
