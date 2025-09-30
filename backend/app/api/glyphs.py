"""
Glyph API Endpoints
4D visualization data serving for temporal knowledge navigation
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.glyphs import (
    Glyph4D,
    GlyphGenerator,
    GlyphProtocol,
    GlyphRenderer,
    GlyphType,
)

router = APIRouter(prefix="/api/glyphs", tags=["glyphs"])

# Initialize glyph system components
glyph_generator = GlyphGenerator(spatial_scale=100.0, auto_layout=True)
glyph_renderer = GlyphRenderer(max_glyphs_per_frame=10000, temporal_window_seconds=300)


class GlyphQuery(BaseModel):
    """Query parameters for fetching glyphs"""
    start_time: datetime = Field(..., description="Start of time range")
    end_time: datetime = Field(..., description="End of time range")
    types: Optional[List[GlyphType]] = Field(default=None, description="Filter by glyph types")
    sources: Optional[List[str]] = Field(default=None, description="Filter by data sources")
    limit: int = Field(default=10000, ge=1, le=50000, description="Max glyphs to return")


class TemporalSliceRequest(BaseModel):
    """Request for temporal slice visualization"""
    current_time: datetime = Field(..., description="Current temporal position")
    window_before_seconds: int = Field(default=300, description="Time window before current")
    window_after_seconds: int = Field(default=150, description="Time window after current")
    enable_lod: bool = Field(default=True, description="Enable level-of-detail culling")


class MetricInput(BaseModel):
    """Input for creating glyph from metric"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metric_name: str
    metric_value: float
    metric_type: GlyphType
    source_id: str
    labels: dict = Field(default_factory=dict)


async def get_tenant_id(x_tenant_id: str = Header(default="default")) -> str:
    """Extract tenant ID from header"""
    return x_tenant_id


@router.post("/generate", response_model=dict)
async def generate_glyphs(
    metrics: List[MetricInput],
    tenant_id: str = Depends(get_tenant_id),
    db = Depends(get_db),
):
    """
    Generate glyphs from metric inputs
    Creates 4D positioned glyphs for visualization
    """
    
    # Convert metrics to glyph protocols
    protocols = [
        GlyphProtocol(
            timestamp=m.timestamp,
            metric_name=m.metric_name,
            metric_value=m.metric_value,
            metric_type=m.metric_type,
            source_id=m.source_id,
            tenant_id=tenant_id,
            labels=m.labels,
        )
        for m in metrics
    ]
    
    # Generate glyphs in parallel
    glyphs = await glyph_generator.batch_generate(protocols)
    
    return {
        "generated_count": len(glyphs),
        "glyphs": [g.to_dict() for g in glyphs],
        "tenant_id": tenant_id,
    }


@router.post("/temporal-slice", response_model=dict)
async def get_temporal_slice(
    request: TemporalSliceRequest,
    query: GlyphQuery,
    tenant_id: str = Depends(get_tenant_id),
    db = Depends(get_db),
):
    """
    Get temporal slice of glyphs for 4D visualization
    Returns glyphs within time window with temporal fade applied
    """
    
    # TODO: Fetch glyphs from database based on query
    # For now, generate sample data
    sample_metrics = _generate_sample_metrics(
        start_time=query.start_time,
        end_time=query.end_time,
        count=min(query.limit, 1000)
    )
    
    # Generate glyph stream
    stream = await glyph_generator.generate_stream_from_metrics(
        metrics=sample_metrics,
        time_range=(query.start_time, query.end_time),
        tenant_id=tenant_id
    )
    
    # Filter by type if specified
    if query.types:
        stream.glyphs = [
            g for g in stream.glyphs
            if g.type in query.types
        ]
    
    # Filter by source if specified
    if query.sources:
        stream.glyphs = [
            g for g in stream.glyphs
            if g.metadata.source in query.sources
        ]
    
    # Render temporal slice
    renderer = GlyphRenderer(
        max_glyphs_per_frame=query.limit,
        enable_lod=request.enable_lod
    )
    
    slice_data = renderer.render_temporal_slice(
        stream=stream,
        current_time=request.current_time,
        window_before=request.window_before_seconds,
        window_after=request.window_after_seconds
    )
    
    return slice_data


@router.post("/webgl-buffers", response_model=dict)
async def get_webgl_buffers(
    request: TemporalSliceRequest,
    query: GlyphQuery,
    tenant_id: str = Depends(get_tenant_id),
    db = Depends(get_db),
):
    """
    Get WebGL-optimized buffer data for high-performance rendering
    Returns Float32Array-compatible buffers
    """
    
    # Get temporal slice
    slice_data = await get_temporal_slice(request, query, tenant_id, db)
    
    # Convert to WebGL buffers
    glyphs = [Glyph4D(**g) for g in slice_data["glyphs"]]
    
    webgl_data = glyph_renderer.render_for_webgl(
        glyphs=glyphs,
        current_time=request.current_time
    )
    
    return webgl_data


@router.get("/timeline", response_model=dict)
async def get_timeline(
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    resolution_seconds: int = Query(default=60, ge=1, le=3600),
    tenant_id: str = Depends(get_tenant_id),
    db = Depends(get_db),
):
    """
    Get timeline aggregation of glyphs
    Shows temporal distribution and counts by type
    """
    
    # Generate sample stream
    sample_metrics = _generate_sample_metrics(start_time, end_time, count=500)
    
    stream = await glyph_generator.generate_stream_from_metrics(
        metrics=sample_metrics,
        time_range=(start_time, end_time),
        tenant_id=tenant_id
    )
    
    # Render timeline
    timeline_data = glyph_renderer.render_timeline(
        stream=stream,
        resolution_seconds=resolution_seconds
    )
    
    return timeline_data


@router.get("/clusters", response_model=dict)
async def get_spatial_clusters(
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    cluster_distance: float = Query(default=20.0, ge=1.0, le=100.0),
    tenant_id: str = Depends(get_tenant_id),
    db = Depends(get_db),
):
    """
    Get spatial clusters of glyphs
    Groups nearby glyphs for simplified visualization
    """
    
    # Generate sample data
    sample_metrics = _generate_sample_metrics(start_time, end_time, count=300)
    
    stream = await glyph_generator.generate_stream_from_metrics(
        metrics=sample_metrics,
        time_range=(start_time, end_time),
        tenant_id=tenant_id
    )
    
    # Render clusters
    cluster_data = glyph_renderer.render_spatial_clusters(
        glyphs=stream.glyphs,
        cluster_distance=cluster_distance
    )
    
    return cluster_data


@router.get("/types", response_model=List[str])
async def get_glyph_types():
    """Get available glyph types"""
    return [t.value for t in GlyphType]


@router.post("/timeline-markers", response_model=dict)
async def generate_timeline_markers(
    start_time: datetime,
    end_time: datetime,
    interval_seconds: int = Query(default=60, ge=1, le=3600),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Generate timeline marker glyphs for temporal navigation
    Creates visual time markers in 4D space
    """
    
    markers = await glyph_generator.generate_timeline_glyphs(
        start_time=start_time,
        end_time=end_time,
        interval_seconds=interval_seconds,
        glyph_type=GlyphType.CUSTOM_EVENT
    )
    
    return {
        "markers": [m.to_dict() for m in markers],
        "count": len(markers),
        "interval_seconds": interval_seconds,
    }


# Helper functions

def _generate_sample_metrics(
    start_time: datetime,
    end_time: datetime,
    count: int = 100
) -> List[dict]:
    """Generate sample metrics for testing (replace with real data later)"""
    
    import random
    
    metrics = []
    time_delta = (end_time - start_time).total_seconds()
    
    metric_types = [
        ("cpu_usage", GlyphType.CPU_METRIC, 0.0, 100.0),
        ("memory_usage", GlyphType.MEMORY_METRIC, 0.0, 100.0),
        ("network_bytes", GlyphType.NETWORK_METRIC, 0.0, 1000000.0),
        ("api_latency", GlyphType.API_REQUEST, 0.0, 5000.0),
        ("error_count", GlyphType.ERROR_EVENT, 0.0, 10.0),
    ]
    
    sources = ["server-1", "server-2", "server-3", "app-api", "db-primary"]
    
    for i in range(count):
        # Random time within range
        offset = random.random() * time_delta
        timestamp = start_time + timedelta(seconds=offset)
        
        # Random metric
        name, mtype, min_val, max_val = random.choice(metric_types)
        value = random.uniform(min_val, max_val)
        
        metrics.append({
            "timestamp": timestamp,
            "name": name,
            "value": value,
            "type": mtype,
            "source": random.choice(sources),
            "labels": {
                "environment": "production",
                "region": "us-east-1"
            }
        })
    
    return metrics
