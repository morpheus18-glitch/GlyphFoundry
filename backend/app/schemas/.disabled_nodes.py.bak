"""Pydantic schemas for node management."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import ORMModel


class NodeCreate(BaseModel):
    name: str = Field(..., max_length=128)
    labels: Optional[dict] = None


class NodeUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=32)
    healthy: Optional[bool] = None
    cpu_usage: Optional[float] = Field(None, ge=0)
    memory_usage: Optional[float] = Field(None, ge=0)
    labels: Optional[dict] = None


class NodeRead(ORMModel):
    id: int
    name: str
    status: str
    healthy: bool
    cpu_usage: float
    memory_usage: float
    labels: Optional[dict]
    last_heartbeat: datetime
    created_at: datetime
    updated_at: datetime


class NodeHealthSummary(BaseModel):
    total_nodes: int
    healthy_nodes: int
    degraded_nodes: int
    unhealthy_nodes: int
