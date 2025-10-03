"""Knowledge Graph API endpoints with multi-tenant support."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_
from pydantic import BaseModel, Field
import uuid
from datetime import datetime
import hashlib
import colorsys

from ..db import get_db
from ..vector_service import vector_service

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge-graph"])

# Color palettes for different node types
NODE_TYPE_PALETTES = {
    "message": {"hue": 180, "sat_range": (0.6, 0.9), "val_range": (0.7, 0.95)},  # Cyan family
    "entity": {"hue": 300, "sat_range": (0.65, 0.95), "val_range": (0.65, 0.9)},  # Magenta family
    "event": {"hue": 60, "sat_range": (0.7, 0.95), "val_range": (0.75, 0.95)},   # Yellow family
    "concept": {"hue": 270, "sat_range": (0.6, 0.85), "val_range": (0.7, 0.9)},  # Purple family
    "document": {"hue": 30, "sat_range": (0.65, 0.9), "val_range": (0.7, 0.95)}, # Orange family
    "metric": {"hue": 120, "sat_range": (0.6, 0.9), "val_range": (0.65, 0.9)},   # Green family
    "default": {"hue": 200, "sat_range": (0.6, 0.85), "val_range": (0.7, 0.9)}   # Blue family
}

def generate_node_color(
    kind: str,
    node_id: str,
    created_at: datetime,
    connection_strength: float = 0.0,
    importance_score: float = 0.5
) -> str:
    """Generate a unique color for a node based on its properties."""
    
    # Get base palette for this node type
    palette = NODE_TYPE_PALETTES.get(kind, NODE_TYPE_PALETTES["default"])
    base_hue = palette["hue"]
    
    # Add time-based variation to hue (±30 degrees)
    time_hash = int(hashlib.md5(str(created_at).encode()).hexdigest()[:8], 16)
    hue_variation = (time_hash % 60) - 30
    hue = (base_hue + hue_variation) % 360
    
    # ID-based saturation variation within range
    id_hash = int(hashlib.md5(node_id.encode()).hexdigest()[:8], 16)
    sat_min, sat_max = palette["sat_range"]
    saturation = sat_min + (id_hash % 100) / 100.0 * (sat_max - sat_min)
    
    # Connection strength affects saturation (more connected = more saturated)
    saturation = min(1.0, saturation + connection_strength * 0.15)
    
    # Importance affects value/brightness
    val_min, val_max = palette["val_range"]
    value = val_min + importance_score * (val_max - val_min)
    
    # Convert HSV to RGB
    r, g, b = colorsys.hsv_to_rgb(hue / 360.0, saturation, value)
    
    # Return as hex color
    return f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"

# Pydantic models for requests/responses
class NodeCreate(BaseModel):
    kind: str = "message"
    name: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    color: Optional[str] = "#4A90E2"
    size: Optional[float] = 1.0
    glow_intensity: Optional[float] = 0.5

class NodeResponse(BaseModel):
    id: str
    tenant_id: str
    kind: str
    name: Optional[str]
    summary: Optional[str]
    pos_x: float
    pos_y: float
    pos_z: float
    color: str
    size: float
    opacity: float
    glow_intensity: float
    importance_score: float
    connection_strength: float
    created_at: datetime

class EdgeResponse(BaseModel):
    id: str
    src_id: str
    dst_id: str
    edge_type: str
    relation_name: Optional[str]
    weight: float
    confidence: float
    color: str
    thickness: float
    opacity: float
    auto_generated: bool
    created_at: datetime

class GraphResponse(BaseModel):
    nodes: List[NodeResponse]
    edges: List[EdgeResponse]
    stats: Dict[str, Any]

class SimilaritySearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, le=100)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)

# Helper function to get tenant ID (simplified for demo)
def get_current_tenant() -> str:
    # In production, this would extract from JWT token or request headers
    return "default-tenant"

@router.post("/tenants/{tenant_id}/nodes", response_model=NodeResponse)
async def create_node(
    tenant_id: str,
    node: NodeCreate,
    db: Session = Depends(get_db)
):
    """Create a new knowledge node with vector embedding."""
    
    # Validate and normalize tenant_id - check if it exists (by name or UUID)
    try:
        # Try as UUID first
        tenant_check = db.execute(text("SELECT id FROM tenants WHERE id::text = :tenant_id LIMIT 1"), 
                                   {'tenant_id': tenant_id}).fetchone()
    except Exception:
        tenant_check = None
    
    if not tenant_check:
        # Try as name
        tenant_check = db.execute(text("SELECT id FROM tenants WHERE name = :tenant_name LIMIT 1"), 
                                   {'tenant_name': tenant_id}).fetchone()
    
    if not tenant_check:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found")
    actual_tenant_id = str(tenant_check.id)
    
    # Generate embedding if content provided
    embedding = None
    if node.content:
        embedding = vector_service.generate_embedding(node.content)
    elif node.name:
        embedding = vector_service.generate_embedding(node.name)
    
    # Convert embedding to PostgreSQL vector format
    embedding_str = f"[{','.join(map(str, embedding))}]" if embedding else None
    
    # Create node with all required fields populated
    import json
    
    # First, insert the node and let Postgres generate the ID
    sql = text("""
        INSERT INTO nodes_v2 (
            tenant_id, kind, name, summary, content, metadata,
            embedding_384, pos_x, pos_y, pos_z, size, 
            opacity, glow_intensity, importance_score, connection_strength
        ) VALUES (
            :tenant_id, CAST(:kind AS node_kind_enum), :name, :summary, :content, CAST(:metadata AS jsonb),
            CAST(:embedding_384 AS vector), :pos_x, :pos_y, :pos_z, :size,
            :opacity, :glow_intensity, :importance_score, :connection_strength
        ) RETURNING *
    """)
    
    result = db.execute(sql, {
        'tenant_id': actual_tenant_id,
        'kind': node.kind,
        'name': node.name,
        'summary': node.summary,
        'content': node.content,
        'metadata': json.dumps(node.metadata or {}),
        'embedding_384': embedding_str,
        'pos_x': 0.0,  # Default to origin, will be positioned by layout algorithm
        'pos_y': 0.0,
        'pos_z': 0.0,
        'size': node.size,
        'opacity': 1.0,  # Default opacity
        'glow_intensity': node.glow_intensity,
        'importance_score': 0.5,
        'connection_strength': 0.0
    })
    
    new_node = result.fetchone()
    
    # Now generate and update the color based on the created node's properties
    generated_color = generate_node_color(
        kind=new_node.kind,
        node_id=str(new_node.id),
        created_at=new_node.created_at,
        connection_strength=new_node.connection_strength or 0.0,
        importance_score=new_node.importance_score or 0.5
    )
    
    # Update the node with the generated color
    update_sql = text("""
        UPDATE nodes_v2 
        SET color = :color 
        WHERE id = :id
        RETURNING *
    """)
    
    result = db.execute(update_sql, {'color': generated_color, 'id': new_node.id})
    
    new_node = result.fetchone()
    db.commit()
    
    # TODO: Re-enable autonomous connections after refactoring to use raw SQL
    # if embedding:
    #     vector_service.create_autonomous_connections(
    #         db, actual_tenant_id, str(new_node.id), 
    #         similarity_threshold=0.75, max_connections=3
    #     )
    #     vector_service.update_node_importance(db, actual_tenant_id, str(new_node.id))
    
    return NodeResponse(
        id=str(new_node.id),
        tenant_id=str(new_node.tenant_id),
        kind=new_node.kind,
        name=new_node.name,
        summary=new_node.summary,
        pos_x=new_node.pos_x,
        pos_y=new_node.pos_y,
        pos_z=new_node.pos_z,
        color=new_node.color,
        size=new_node.size,
        opacity=new_node.opacity,
        glow_intensity=new_node.glow_intensity,
        importance_score=new_node.importance_score,
        connection_strength=new_node.connection_strength,
        created_at=new_node.created_at
    )

@router.get("/tenants/{tenant_id}/graph", response_model=GraphResponse)
async def get_knowledge_graph(
    tenant_id: str,
    limit_nodes: int = Query(300, le=5000),
    limit_edges: int = Query(1500, le=10000),
    window_minutes: int = Query(60, le=525600),
    db: Session = Depends(get_db)
):
    """Get the knowledge graph for 3D visualization with spatial positioning."""
    
    # Validate and normalize tenant_id - check if it exists (by name or UUID)
    try:
        # Try as UUID first
        tenant_check = db.execute(text("SELECT id FROM tenants WHERE id::text = :tenant_id LIMIT 1"), 
                                   {'tenant_id': tenant_id}).fetchone()
    except Exception:
        tenant_check = None
    
    if not tenant_check:
        # Try as name
        tenant_check = db.execute(text("SELECT id FROM tenants WHERE name = :tenant_name LIMIT 1"), 
                                   {'tenant_name': tenant_id}).fetchone()
    
    if not tenant_check:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found")
    actual_tenant_id = str(tenant_check.id)
    
    # Enhanced graph query with 3D positioning - nodes independent of edges
    sql = text("""
        WITH positioned_nodes AS (
            SELECT 
                n.*,
                -- Generate spiral galaxy positioning for nodes without positions
                CASE WHEN COALESCE(n.pos_x, 0) = 0 AND COALESCE(n.pos_y, 0) = 0 AND COALESCE(n.pos_z, 0) = 0 THEN
                    (RANDOM() - 0.5) * 200 * (1 + COALESCE(n.importance_score, 0.5))
                ELSE n.pos_x END as calc_x,
                CASE WHEN COALESCE(n.pos_x, 0) = 0 AND COALESCE(n.pos_y, 0) = 0 AND COALESCE(n.pos_z, 0) = 0 THEN
                    (RANDOM() - 0.5) * 200 * (1 + COALESCE(n.importance_score, 0.5))
                ELSE n.pos_y END as calc_y,
                CASE WHEN COALESCE(n.pos_x, 0) = 0 AND COALESCE(n.pos_y, 0) = 0 AND COALESCE(n.pos_z, 0) = 0 THEN
                    (RANDOM() - 0.5) * 50 + SIN(COALESCE(n.importance_score, 0.5) * 10) * 20
                ELSE n.pos_z END as calc_z
            FROM nodes_v2 n
            WHERE n.tenant_id = :tenant_id
              AND n.created_at >= (NOW() - (:window_minutes || ' minutes')::interval)
            ORDER BY COALESCE(n.importance_score, 0) DESC, n.created_at DESC
            LIMIT :limit_nodes
        ),
        recent_edges AS (
            SELECT e.*
            FROM edges_v2 e
            JOIN positioned_nodes src ON src.id = e.src_id
            JOIN positioned_nodes dst ON dst.id = e.dst_id
            WHERE e.tenant_id = :tenant_id
              AND e.created_at >= (NOW() - (:window_minutes || ' minutes')::interval)
            ORDER BY e.weight DESC, e.confidence DESC
            LIMIT :limit_edges
        )
        SELECT 
            'nodes' as type,
            json_agg(
                json_build_object(
                    'id', pn.id::text,
                    'tenant_id', pn.tenant_id::text,
                    'kind', pn.kind::text,
                    'name', COALESCE(pn.name, ''),
                    'summary', COALESCE(pn.summary, ''),
                    'pos_x', COALESCE(pn.calc_x, 0),
                    'pos_y', COALESCE(pn.calc_y, 0),
                    'pos_z', COALESCE(pn.calc_z, 0),
                    'color', COALESCE(pn.color, '#4A90E2'),
                    'size', COALESCE(pn.size, 1.0) * (1 + COALESCE(pn.importance_score, 0) * 0.5),
                    'opacity', COALESCE(pn.opacity, 1.0),
                    'glow_intensity', COALESCE(pn.glow_intensity, 0.5) + COALESCE(pn.importance_score, 0) * 0.3,
                    'importance_score', COALESCE(pn.importance_score, 0),
                    'connection_strength', COALESCE(pn.connection_strength, 0),
                    'created_at', pn.created_at
                )
            ) as data
        FROM positioned_nodes pn
        
        UNION ALL
        
        SELECT 
            'edges' as type,
            json_agg(
                json_build_object(
                    'id', e.id::text,
                    'src_id', e.src_id::text,
                    'dst_id', e.dst_id::text,
                    'edge_type', e.edge_type::text,
                    'relation_name', COALESCE(e.relation_name, ''),
                    'weight', COALESCE(e.weight, 1.0),
                    'confidence', COALESCE(e.confidence, 1.0),
                    'color', CASE WHEN COALESCE(e.auto_generated, false) THEN '#00ff88' ELSE COALESCE(e.color, '#888888') END,
                    'thickness', COALESCE(e.thickness, 1.0) * (0.5 + COALESCE(e.confidence, 1.0) * 0.5),
                    'opacity', COALESCE(e.opacity, 0.8) * COALESCE(e.confidence, 1.0),
                    'auto_generated', COALESCE(e.auto_generated, false),
                    'created_at', e.created_at
                )
            ) as data
        FROM recent_edges e
        JOIN positioned_nodes src ON src.id = e.src_id
        JOIN positioned_nodes dst ON dst.id = e.dst_id
    """)
    
    result = db.execute(sql, {
        'tenant_id': actual_tenant_id,
        'limit_nodes': limit_nodes,
        'limit_edges': limit_edges,
        'window_minutes': window_minutes
    })
    
    rows = result.fetchall()
    nodes_data = []
    edges_data = []
    
    for row in rows:
        if row.type == 'nodes' and row.data:
            nodes_data = row.data
        elif row.type == 'edges' and row.data:
            edges_data = row.data
    
    return GraphResponse(
        nodes=[NodeResponse(**node) for node in (nodes_data or [])],
        edges=[EdgeResponse(**edge) for edge in (edges_data or [])],
        stats={
            "node_count": len(nodes_data or []),
            "edge_count": len(edges_data or []),
            "window_minutes": window_minutes,
            "auto_generated_edges": len([e for e in (edges_data or []) if e.get('auto_generated', False)])
        }
    )

@router.post("/tenants/{tenant_id}/search", response_model=List[NodeResponse])
async def search_similar_nodes(
    tenant_id: str,
    search: SimilaritySearchRequest,
    db: Session = Depends(get_db)
):
    """Search for nodes similar to the query using vector embeddings."""
    
    # Generate query embedding
    query_embedding = vector_service.generate_embedding(search.query)
    
    # Find similar nodes
    similar_nodes = vector_service.find_similar_nodes(
        db, tenant_id, query_embedding, 
        limit=search.limit, 
        similarity_threshold=search.similarity_threshold
    )
    
    results = []
    for node_row, similarity in similar_nodes:
        results.append(NodeResponse(
            id=str(node_row.id),
            tenant_id=str(node_row.tenant_id),
            kind=node_row.kind,
            name=node_row.name,
            summary=node_row.summary,
            pos_x=node_row.pos_x,
            pos_y=node_row.pos_y,
            pos_z=node_row.pos_z,
            color=node_row.color,
            size=node_row.size,
            opacity=node_row.opacity,
            glow_intensity=node_row.glow_intensity,
            importance_score=node_row.importance_score,
            connection_strength=node_row.connection_strength,
            created_at=node_row.created_at
        ))
    
    return results

@router.post("/tenants/{tenant_id}/nodes/{node_id}/learn")
async def trigger_learning(
    tenant_id: str,
    node_id: str,
    db: Session = Depends(get_db)
):
    """Trigger autonomous learning and connection formation for a node."""
    
    # Create new autonomous connections
    new_edges = vector_service.create_autonomous_connections(
        db, tenant_id, node_id,
        similarity_threshold=0.7, max_connections=5
    )
    
    # Update importance scores
    vector_service.update_node_importance(db, tenant_id, node_id)
    
    return {
        "node_id": node_id,
        "new_connections": len(new_edges),
        "edge_ids": new_edges
    }

@router.post("/tenants/{tenant_id}/update-colors")
async def update_node_colors(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """Update all existing nodes with generated colors based on their properties."""
    
    # Fetch all nodes for this tenant
    sql = text("""
        SELECT id, kind, created_at, importance_score, connection_strength
        FROM nodes_v2
        WHERE tenant_id = :tenant_id
    """)
    
    nodes = db.execute(sql, {'tenant_id': tenant_id}).fetchall()
    
    updated_count = 0
    for node in nodes:
        # Generate color based on node properties
        new_color = generate_node_color(
            kind=node.kind,
            node_id=str(node.id),
            created_at=node.created_at,
            connection_strength=node.connection_strength or 0.0,
            importance_score=node.importance_score or 0.5
        )
        
        # Update the node with the new color
        update_sql = text("""
            UPDATE nodes_v2 
            SET color = :color 
            WHERE id = :id
        """)
        db.execute(update_sql, {'color': new_color, 'id': node.id})
        updated_count += 1
    
    db.commit()
    
    return {
        "tenant_id": tenant_id,
        "updated_nodes": updated_count,
        "message": f"Successfully updated {updated_count} nodes with generated colors"
    }