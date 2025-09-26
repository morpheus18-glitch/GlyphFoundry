"""Shared schema definitions."""
from datetime import datetime
from pydantic import BaseModel


class ORMModel(BaseModel):
    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}
