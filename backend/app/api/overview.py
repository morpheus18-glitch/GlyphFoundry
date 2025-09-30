"""Overview endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..db import get_db

router = APIRouter()


@router.get("/overview")
async def get_overview(db: Session = Depends(get_db)):
    """Return system overview with node and edge statistics."""
    
    # Get node count
    node_result = db.execute(text("SELECT COUNT(*) as count FROM nodes"))
    node_count = node_result.scalar() or 0
    
    # Get edge count
    edge_result = db.execute(text("SELECT COUNT(*) as count FROM edges"))
    edge_count = edge_result.scalar() or 0
    
    # Get tag count
    tag_result = db.execute(text("SELECT COUNT(*) as count FROM tags"))
    tag_count = tag_result.scalar() or 0
    
    return {
        "nodes": {
            "total": node_count,
            "healthy": node_count,
            "degraded": 0,
            "failed": 0
        },
        "edges": {
            "total": edge_count
        },
        "tags": {
            "total": tag_count
        },
        "status": "operational",
        "version": "3.0.0"
    }


@router.get("/telemetry")
async def get_telemetry():
    """Return basic telemetry data."""
    import psutil
    import platform
    
    return {
        "system": {
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        },
        "status": "active",
        "timestamp": "2025-09-30T00:00:00Z"
    }
