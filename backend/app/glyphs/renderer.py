"""
Glyph Renderer: Prepares 4D glyphs for WebGL visualization
Handles temporal slicing, LOD, and optimization for 4K rendering
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .types import Glyph4D, GlyphStream, GlyphType


class GlyphRenderer:
    """
    Prepares glyph data for efficient 4D visualization
    Implements temporal slicing and level-of-detail optimization
    """
    
    def __init__(
        self,
        max_glyphs_per_frame: int = 10000,
        temporal_window_seconds: int = 300,
        enable_lod: bool = True
    ):
        self.max_glyphs_per_frame = max_glyphs_per_frame
        self.temporal_window_seconds = temporal_window_seconds
        self.enable_lod = enable_lod
    
    def render_temporal_slice(
        self,
        stream: GlyphStream,
        current_time: datetime,
        window_before: Optional[int] = None,
        window_after: Optional[int] = None
    ) -> Dict:
        """
        Render glyphs within temporal window around current_time
        This creates the 4D visualization slice (read-only, no mutations)
        """
        
        # Calculate time window
        before_seconds = window_before or self.temporal_window_seconds
        after_seconds = window_after or (self.temporal_window_seconds // 2)
        
        start_time = current_time - timedelta(seconds=before_seconds)
        end_time = current_time + timedelta(seconds=after_seconds)
        
        # Filter glyphs in window
        visible_glyphs = stream.filter_by_time_range(start_time, end_time)
        
        # Apply LOD if needed
        if self.enable_lod and len(visible_glyphs) > self.max_glyphs_per_frame:
            visible_glyphs = self._apply_lod(visible_glyphs, current_time)
        
        # Calculate temporal depth and opacity (per-frame, no mutations)
        rendered_glyphs = []
        for glyph in visible_glyphs:
            time_delta = (glyph.coordinate.t - current_time).total_seconds()
            
            # Compute opacity for this frame (don't mutate original)
            time_fade = 1.0 - (abs(time_delta) / before_seconds)
            frame_opacity = glyph.metadata.opacity * max(time_fade, 0.2)
            
            # Create frame-specific render data
            glyph_dict = glyph.to_dict()
            glyph_dict["metadata"]["temporal_depth"] = time_delta
            glyph_dict["metadata"]["opacity"] = frame_opacity
            rendered_glyphs.append(glyph_dict)
        
        return {
            "glyphs": rendered_glyphs,
            "current_time": current_time.isoformat(),
            "time_window": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
            },
            "count": len(visible_glyphs),
            "lod_applied": len(stream.glyphs) > len(visible_glyphs),
        }
    
    def render_spatial_clusters(
        self,
        glyphs: List[Glyph4D],
        cluster_distance: float = 20.0
    ) -> Dict:
        """Group nearby glyphs into clusters for visualization"""
        
        clusters = []
        processed = set()
        
        for i, glyph in enumerate(glyphs):
            if i in processed:
                continue
            
            cluster = [glyph]
            processed.add(i)
            
            # Find nearby glyphs
            for j, other in enumerate(glyphs[i+1:], start=i+1):
                if j in processed:
                    continue
                
                distance = self._spatial_distance(glyph, other)
                if distance < cluster_distance:
                    cluster.append(other)
                    processed.add(j)
            
            # Calculate cluster center
            avg_x = sum(g.coordinate.x for g in cluster) / len(cluster)
            avg_y = sum(g.coordinate.y for g in cluster) / len(cluster)
            avg_z = sum(g.coordinate.z for g in cluster) / len(cluster)
            
            clusters.append({
                "center": {"x": avg_x, "y": avg_y, "z": avg_z},
                "glyphs": [g.to_dict() for g in cluster],
                "count": len(cluster),
                "dominant_type": self._get_dominant_type(cluster),
            })
        
        return {
            "clusters": clusters,
            "total_clusters": len(clusters),
            "total_glyphs": len(glyphs),
        }
    
    def render_timeline(
        self,
        stream: GlyphStream,
        resolution_seconds: int = 60
    ) -> Dict:
        """
        Create timeline visualization data
        Shows temporal distribution of glyphs
        """
        
        timeline = []
        current = stream.time_range_start
        
        while current <= stream.time_range_end:
            next_time = current + timedelta(seconds=resolution_seconds)
            
            # Count glyphs in this time bucket
            bucket_glyphs = [
                g for g in stream.glyphs
                if current <= g.coordinate.t < next_time
            ]
            
            # Aggregate by type
            type_counts = {}
            for glyph in bucket_glyphs:
                type_name = glyph.type.value
                type_counts[type_name] = type_counts.get(type_name, 0) + 1
            
            timeline.append({
                "timestamp": current.isoformat(),
                "count": len(bucket_glyphs),
                "types": type_counts,
            })
            
            current = next_time
        
        return {
            "timeline": timeline,
            "resolution_seconds": resolution_seconds,
            "total_buckets": len(timeline),
        }
    
    def render_for_webgl(
        self,
        glyphs: List[Glyph4D],
        current_time: datetime
    ) -> Dict:
        """
        Optimize glyph data for WebGL rendering
        Creates efficient buffer-compatible format
        """
        
        # Prepare position buffer (x, y, z, time_offset)
        positions = []
        colors = []
        sizes = []
        metadata = []
        
        for glyph in glyphs:
            # Time as offset from current_time (4th dimension)
            time_offset = (glyph.coordinate.t - current_time).total_seconds()
            
            positions.extend([
                glyph.coordinate.x,
                glyph.coordinate.y,
                glyph.coordinate.z,
                time_offset
            ])
            
            # Parse color to RGB
            color_hex = glyph.metadata.color.lstrip('#')
            r = int(color_hex[0:2], 16) / 255.0
            g = int(color_hex[2:4], 16) / 255.0
            b = int(color_hex[4:6], 16) / 255.0
            
            colors.extend([r, g, b, glyph.metadata.opacity])
            
            sizes.append(glyph.metadata.size)
            
            metadata.append({
                "id": str(glyph.id),
                "type": glyph.type.value,
                "label": glyph.metadata.label,
                "value": glyph.metadata.value,
            })
        
        return {
            "buffers": {
                "positions": positions,  # Float32Array compatible
                "colors": colors,        # Float32Array compatible
                "sizes": sizes,          # Float32Array compatible
            },
            "metadata": metadata,
            "count": len(glyphs),
            "current_time": current_time.isoformat(),
        }
    
    def _apply_lod(
        self,
        glyphs: List[Glyph4D],
        current_time: datetime
    ) -> List[Glyph4D]:
        """Apply level-of-detail culling"""
        
        # Priority: closer in time = higher priority
        glyphs_with_priority = [
            (g, abs((g.coordinate.t - current_time).total_seconds()))
            for g in glyphs
        ]
        
        # Sort by temporal distance (closer = first)
        glyphs_with_priority.sort(key=lambda x: x[1])
        
        # Take top N
        return [g for g, _ in glyphs_with_priority[:self.max_glyphs_per_frame]]
    
    @staticmethod
    def _spatial_distance(glyph1: Glyph4D, glyph2: Glyph4D) -> float:
        """Calculate Euclidean distance between two glyphs"""
        dx = glyph1.coordinate.x - glyph2.coordinate.x
        dy = glyph1.coordinate.y - glyph2.coordinate.y
        dz = glyph1.coordinate.z - glyph2.coordinate.z
        return (dx**2 + dy**2 + dz**2) ** 0.5
    
    @staticmethod
    def _get_dominant_type(glyphs: List[Glyph4D]) -> str:
        """Find most common glyph type in cluster"""
        type_counts = {}
        for glyph in glyphs:
            type_name = glyph.type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1
        
        return max(type_counts.items(), key=lambda x: x[1])[0] if type_counts else "unknown"
