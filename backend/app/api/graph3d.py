"""Graph 3D visualization endpoints - simplified frontend API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from ..db import get_db

router = APIRouter()

@router.get("/graph3d/data")
async def get_graph_data(
    window_minutes: int = Query(4320, description="Time window in minutes"),
    limit_nodes: int = Query(300, description="Max nodes to return"),
    limit_edges: int = Query(1500, description="Max edges to return"),
    db: Session = Depends(get_db)
):
    """Get graph data for 3D visualization."""
    tenant_id = "00000000-0000-0000-0000-000000000001"
    
    nodes_sql = text("""
        SELECT 
            id::text,
            kind,
            COALESCE(name, 'Node') as label,
            COALESCE(summary, '') as summary,
            COALESCE(
                (SELECT COUNT(*) FROM edges WHERE src_id = nodes.id OR dst_id = nodes.id),
                0
            ) as degree,
            EXTRACT(EPOCH FROM created_at)::bigint as ts
        FROM nodes
        WHERE tenant_id = :tenant_id
        AND created_at >= NOW() - (:window_minutes || ' minutes')::interval
        ORDER BY created_at DESC
        LIMIT :limit_nodes
    """)
    
    edges_sql = text("""
        SELECT 
            src_id::text as source,
            dst_id::text as target,
            COALESCE(relation_name, edge_type::text) as rel,
            weight,
            EXTRACT(EPOCH FROM created_at)::bigint as ts
        FROM edges
        WHERE tenant_id = :tenant_id
        AND created_at >= NOW() - (:window_minutes || ' minutes')::interval
        ORDER BY weight DESC
        LIMIT :limit_edges
    """)
    
    nodes_result = db.execute(nodes_sql, {
        'tenant_id': tenant_id,
        'window_minutes': window_minutes,
        'limit_nodes': limit_nodes
    })
    
    edges_result = db.execute(edges_sql, {
        'tenant_id': tenant_id,
        'window_minutes': window_minutes,
        'limit_edges': limit_edges
    })
    
    nodes = [
        {
            'id': row.id,
            'kind': row.kind,
            'label': row.label,
            'summary': row.summary,
            'degree': row.degree,
            'ts': row.ts
        }
        for row in nodes_result.fetchall()
    ]
    
    edges = [
        {
            'source': row.source,
            'target': row.target,
            'rel': row.rel,
            'weight': row.weight,
            'ts': row.ts
        }
        for row in edges_result.fetchall()
    ]
    
    return {
        'nodes': nodes,
        'edges': edges,
        'stats': {
            'node_count': len(nodes),
            'edge_count': len(edges),
            'window_minutes': window_minutes
        }
    }

@router.get("/tags/data")
async def get_tags_data(db: Session = Depends(get_db)):
    """Get tags data for visualization."""
    sql = text("""
        SELECT 
            t.id::text as tag_id,
            t.slug,
            t.name,
            nt.node_id::text,
            nt.confidence
        FROM tags t
        JOIN node_tags nt ON nt.tag_id = t.id
        ORDER BY nt.confidence DESC
        LIMIT 100
    """)
    
    result = db.execute(sql)
    
    items = [
        {
            'tag_id': row.tag_id,
            'slug': row.slug,
            'name': row.name,
            'node_id': row.node_id,
            'confidence': row.confidence
        }
        for row in result.fetchall()
    ]
    
    return {'items': items}
