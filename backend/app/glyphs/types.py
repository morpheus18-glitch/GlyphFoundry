"""
Core 4D Glyph Type Definitions
Space (x,y,z) + Time (t) for temporal knowledge visualization
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class GlyphType(str, Enum):
    """Visual glyph types for different metric/event categories"""
    
    # System Metrics
    CPU_METRIC = "cpu_metric"
    MEMORY_METRIC = "memory_metric"
    NETWORK_METRIC = "network_metric"
    DISK_METRIC = "disk_metric"
    
    # Application Events
    API_REQUEST = "api_request"
    API_RESPONSE = "api_response"
    ERROR_EVENT = "error_event"
    WARNING_EVENT = "warning_event"
    
    # Knowledge Events
    NODE_CREATED = "node_created"
    EDGE_CREATED = "edge_created"
    EMBEDDING_GENERATED = "embedding_generated"
    QUERY_EXECUTED = "query_executed"
    
    # User Activity
    USER_LOGIN = "user_login"
    USER_ACTION = "user_action"
    CONVERSATION_TURN = "conversation_turn"
    
    # Custom
    CUSTOM_METRIC = "custom_metric"
    CUSTOM_EVENT = "custom_event"


class TemporalCoordinate(BaseModel):
    """4D coordinate system: 3D space + time"""
    
    x: float = Field(..., description="Spatial X coordinate")
    y: float = Field(..., description="Spatial Y coordinate")
    z: float = Field(..., description="Spatial Z coordinate")
    t: datetime = Field(..., description="Temporal coordinate (4th dimension)")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "t": self.t.isoformat(),
        }


class GlyphMetadata(BaseModel):
    """Rich metadata for glyph rendering and interaction"""
    
    # Visual properties
    color: str = Field(default="#4ecdc4", description="Hex color code")
    size: float = Field(default=1.0, ge=0.1, le=10.0, description="Glyph size")
    opacity: float = Field(default=0.8, ge=0.0, le=1.0, description="Transparency")
    intensity: float = Field(default=1.0, ge=0.0, le=2.0, description="Glow intensity")
    
    # Shape and pattern
    shape: str = Field(default="sphere", description="Glyph shape type")
    pattern: Optional[str] = Field(default=None, description="Surface pattern")
    
    # Animation
    pulse_speed: float = Field(default=1.0, description="Pulse animation speed")
    rotation_speed: float = Field(default=0.0, description="Rotation speed")
    
    # Data properties
    value: float = Field(..., description="Primary metric value")
    unit: str = Field(default="", description="Unit of measurement")
    label: str = Field(default="", description="Human-readable label")
    
    # Context
    source: str = Field(..., description="Data source identifier")
    tenant_id: Optional[str] = Field(default=None, description="Multi-tenant isolation")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    
    # Additional data
    extra: Dict[str, Any] = Field(default_factory=dict, description="Custom attributes")


class Glyph4D(BaseModel):
    """
    4D Glyph: The fundamental unit of temporal knowledge visualization
    Represents a moment in space-time with rich metadata
    """
    
    id: UUID = Field(default_factory=uuid4)
    type: GlyphType = Field(..., description="Glyph category")
    coordinate: TemporalCoordinate = Field(..., description="4D position")
    metadata: GlyphMetadata = Field(..., description="Visual and data properties")
    
    # Relationships
    parent_id: Optional[UUID] = Field(default=None, description="Parent glyph ID")
    related_node_id: Optional[UUID] = Field(default=None, description="Knowledge graph node ID")
    
    # Lifecycle
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None, description="TTL for cleanup")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary"""
        return {
            "id": str(self.id),
            "type": self.type.value,
            "coordinate": self.coordinate.to_dict(),
            "metadata": self.metadata.dict(),
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "related_node_id": str(self.related_node_id) if self.related_node_id else None,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class GlyphProtocol(BaseModel):
    """
    Protocol for creating glyphs from raw events/metrics
    Handles timestamp-to-coordinate conversion and visual mapping
    """
    
    # Source data
    timestamp: datetime = Field(..., description="Event timestamp")
    metric_name: str = Field(..., description="Metric/event identifier")
    metric_value: float = Field(..., description="Numeric value")
    metric_type: GlyphType = Field(..., description="Glyph type to create")
    
    # Spatial mapping (how to convert metric to x,y,z)
    spatial_dimensions: Dict[str, float] = Field(
        default_factory=dict,
        description="Optional manual x,y,z override"
    )
    
    # Context
    source_id: str = Field(..., description="Source system/service")
    tenant_id: Optional[str] = Field(default=None)
    labels: Dict[str, str] = Field(default_factory=dict)
    
    def create_glyph(
        self,
        x: Optional[float] = None,
        y: Optional[float] = None,
        z: Optional[float] = None,
    ) -> Glyph4D:
        """Create a 4D glyph from this protocol"""
        
        # Use provided coordinates or auto-generate
        coord = TemporalCoordinate(
            x=x or self.spatial_dimensions.get("x", 0.0),
            y=y or self.spatial_dimensions.get("y", 0.0),
            z=z or self.spatial_dimensions.get("z", 0.0),
            t=self.timestamp,
        )
        
        # Map metric value to visual properties
        normalized_value = min(max(self.metric_value, 0), 1)
        
        metadata = GlyphMetadata(
            value=self.metric_value,
            size=0.5 + (normalized_value * 2.0),  # Scale 0.5 to 2.5
            intensity=normalized_value * 1.5,
            color=self._get_color_for_type(),
            label=self.metric_name,
            source=self.source_id,
            tenant_id=self.tenant_id,
            tags=list(self.labels.keys()),
            extra=self.labels,
        )
        
        return Glyph4D(
            type=self.metric_type,
            coordinate=coord,
            metadata=metadata,
        )
    
    def _get_color_for_type(self) -> str:
        """Map glyph type to default color"""
        color_map = {
            GlyphType.CPU_METRIC: "#ff6b6b",      # Red
            GlyphType.MEMORY_METRIC: "#4ecdc4",   # Cyan
            GlyphType.NETWORK_METRIC: "#45b7d1",  # Blue
            GlyphType.DISK_METRIC: "#f9ca24",     # Yellow
            GlyphType.API_REQUEST: "#6c5ce7",     # Purple
            GlyphType.ERROR_EVENT: "#ff3838",     # Bright red
            GlyphType.WARNING_EVENT: "#ffa502",   # Orange
            GlyphType.NODE_CREATED: "#26de81",    # Green
            GlyphType.EDGE_CREATED: "#20bf6b",    # Dark green
            GlyphType.USER_LOGIN: "#a29bfe",      # Light purple
            GlyphType.CONVERSATION_TURN: "#fd79a8", # Pink
        }
        return color_map.get(self.metric_type, "#4ecdc4")


class GlyphStream(BaseModel):
    """Collection of glyphs with temporal range"""
    
    glyphs: List[Glyph4D] = Field(default_factory=list)
    time_range_start: datetime = Field(...)
    time_range_end: datetime = Field(...)
    total_count: int = Field(default=0)
    
    def add_glyph(self, glyph: Glyph4D) -> None:
        """Add glyph to stream"""
        self.glyphs.append(glyph)
        self.total_count = len(self.glyphs)
    
    def filter_by_type(self, glyph_type: GlyphType) -> List[Glyph4D]:
        """Filter glyphs by type"""
        return [g for g in self.glyphs if g.type == glyph_type]
    
    def filter_by_time_range(
        self,
        start: datetime,
        end: datetime
    ) -> List[Glyph4D]:
        """Filter glyphs within time range"""
        return [
            g for g in self.glyphs
            if start <= g.coordinate.t <= end
        ]
