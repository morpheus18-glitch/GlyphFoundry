"""
Glyph Generator: Creates 4D glyphs from metrics, events, and knowledge graph data
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID

import numpy as np

from .types import (
    Glyph4D,
    GlyphProtocol,
    GlyphStream,
    GlyphType,
    TemporalCoordinate,
    GlyphMetadata,
)


class GlyphGenerator:
    """
    High-performance glyph generation from various data sources
    Implements spatial distribution algorithms for 4D visualization
    """
    
    def __init__(
        self,
        spatial_scale: float = 100.0,
        temporal_scale: float = 1.0,
        auto_layout: bool = True
    ):
        self.spatial_scale = spatial_scale
        self.temporal_scale = temporal_scale
        self.auto_layout = auto_layout
        
        # Track glyph positions to avoid collisions
        self._position_registry: Dict[str, List[float]] = {}
    
    async def generate_from_protocol(
        self,
        protocol: GlyphProtocol,
        auto_position: bool = True
    ) -> Glyph4D:
        """Generate a single glyph from protocol"""
        
        if auto_position and self.auto_layout:
            x, y, z = await self._compute_spatial_position(protocol)
        else:
            x = protocol.spatial_dimensions.get("x", 0.0)
            y = protocol.spatial_dimensions.get("y", 0.0)
            z = protocol.spatial_dimensions.get("z", 0.0)
        
        glyph = protocol.create_glyph(x=x, y=y, z=z)
        
        # Register position
        self._register_position(glyph.id, x, y, z)
        
        return glyph
    
    async def generate_stream_from_metrics(
        self,
        metrics: List[Dict],
        time_range: tuple[datetime, datetime],
        tenant_id: Optional[str] = None
    ) -> GlyphStream:
        """Generate glyph stream from metric data"""
        
        stream = GlyphStream(
            time_range_start=time_range[0],
            time_range_end=time_range[1],
        )
        
        for metric in metrics:
            protocol = GlyphProtocol(
                timestamp=metric.get("timestamp", datetime.utcnow()),
                metric_name=metric["name"],
                metric_value=metric["value"],
                metric_type=self._infer_glyph_type(metric),
                source_id=metric.get("source", "unknown"),
                tenant_id=tenant_id,
                labels=metric.get("labels", {}),
            )
            
            glyph = await self.generate_from_protocol(protocol)
            stream.add_glyph(glyph)
        
        return stream
    
    async def generate_timeline_glyphs(
        self,
        start_time: datetime,
        end_time: datetime,
        interval_seconds: int = 60,
        glyph_type: GlyphType = GlyphType.CUSTOM_EVENT
    ) -> List[Glyph4D]:
        """Generate timeline marker glyphs for 4D navigation"""
        
        glyphs = []
        current_time = start_time
        
        while current_time <= end_time:
            # Timeline glyphs form a temporal backbone
            glyph = Glyph4D(
                type=glyph_type,
                coordinate=TemporalCoordinate(
                    x=0.0,
                    y=0.0,
                    z=0.0,
                    t=current_time
                ),
                metadata=GlyphMetadata(
                    value=0.0,
                    size=0.3,
                    opacity=0.3,
                    color="#888888",
                    label=current_time.strftime("%H:%M:%S"),
                    source="timeline"
                )
            )
            glyphs.append(glyph)
            current_time += timedelta(seconds=interval_seconds)
        
        return glyphs
    
    async def _compute_spatial_position(
        self,
        protocol: GlyphProtocol
    ) -> tuple[float, float, float]:
        """
        Auto-compute spatial position based on metric properties
        Uses deterministic hash-based layout for reproducibility
        """
        
        # Use stable hash for deterministic positioning across restarts
        import hashlib
        hash_input = f"{protocol.metric_name}:{protocol.source_id}".encode()
        hash_bytes = hashlib.blake2b(hash_input, digest_size=16).digest()
        
        # Convert hash to seed (stable across runs)
        hash_seed = int.from_bytes(hash_bytes[:4], 'big') % (2**31)
        
        # Create local RNG instance (no global state mutation)
        rng = np.random.default_rng(hash_seed)
        
        # Distribute based on metric type (different clusters)
        type_offset = self._get_type_offset(protocol.metric_type)
        
        # Add deterministic randomness for natural clustering
        x = type_offset[0] + rng.standard_normal() * 10
        y = type_offset[1] + rng.standard_normal() * 10
        z = type_offset[2] + rng.standard_normal() * 10
        
        # Scale based on metric value (magnitude affects position)
        magnitude = min(abs(protocol.metric_value), 1.0)
        scale_factor = 1.0 + magnitude
        
        x *= scale_factor
        y *= scale_factor
        z *= scale_factor
        
        return float(x), float(y), float(z)
    
    def _get_type_offset(self, glyph_type: GlyphType) -> tuple[float, float, float]:
        """Get base position offset for glyph type (creates natural clusters)"""
        
        offsets = {
            # System metrics cluster
            GlyphType.CPU_METRIC: (50, 0, 0),
            GlyphType.MEMORY_METRIC: (50, 20, 0),
            GlyphType.NETWORK_METRIC: (50, -20, 0),
            GlyphType.DISK_METRIC: (50, 0, 20),
            
            # API events cluster
            GlyphType.API_REQUEST: (-50, 0, 0),
            GlyphType.API_RESPONSE: (-50, 10, 0),
            GlyphType.ERROR_EVENT: (-50, -30, 0),
            GlyphType.WARNING_EVENT: (-50, -20, 0),
            
            # Knowledge events cluster
            GlyphType.NODE_CREATED: (0, 50, 0),
            GlyphType.EDGE_CREATED: (0, 50, 20),
            GlyphType.EMBEDDING_GENERATED: (0, 50, -20),
            GlyphType.QUERY_EXECUTED: (0, 40, 0),
            
            # User activity cluster
            GlyphType.USER_LOGIN: (0, -50, 0),
            GlyphType.USER_ACTION: (0, -40, 10),
            GlyphType.CONVERSATION_TURN: (0, -40, -10),
        }
        
        return offsets.get(glyph_type, (0, 0, 0))
    
    def _infer_glyph_type(self, metric: Dict) -> GlyphType:
        """Infer glyph type from metric properties"""
        
        name = metric.get("name", "").lower()
        
        if "cpu" in name:
            return GlyphType.CPU_METRIC
        elif "memory" in name or "ram" in name:
            return GlyphType.MEMORY_METRIC
        elif "network" in name or "bandwidth" in name:
            return GlyphType.NETWORK_METRIC
        elif "disk" in name or "storage" in name:
            return GlyphType.DISK_METRIC
        elif "request" in name or "api" in name:
            return GlyphType.API_REQUEST
        elif "error" in name:
            return GlyphType.ERROR_EVENT
        elif "warning" in name or "warn" in name:
            return GlyphType.WARNING_EVENT
        else:
            return GlyphType.CUSTOM_METRIC
    
    def _register_position(
        self,
        glyph_id: UUID,
        x: float,
        y: float,
        z: float
    ) -> None:
        """Register glyph position to track spatial distribution"""
        self._position_registry[str(glyph_id)] = [x, y, z]
    
    async def batch_generate(
        self,
        protocols: List[GlyphProtocol],
        max_concurrent: int = 100
    ) -> List[Glyph4D]:
        """Generate glyphs in parallel for performance"""
        
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def generate_with_limit(protocol: GlyphProtocol) -> Glyph4D:
            async with semaphore:
                return await self.generate_from_protocol(protocol)
        
        tasks = [generate_with_limit(p) for p in protocols]
        return await asyncio.gather(*tasks)
