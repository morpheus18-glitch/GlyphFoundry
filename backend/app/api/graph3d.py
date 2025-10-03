"""Graph 3D visualization endpoints - simplified frontend API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
import random
import math
from ..db import get_db

router = APIRouter()

@router.get("/graph3d/data")
async def get_graph_data(
    window_minutes: int = Query(4320, description="Time window in minutes"),
    limit_nodes: int = Query(1500, description="Max nodes to return"),
    limit_edges: int = Query(5000, description="Max edges to return"),
    db: Session = Depends(get_db)
):
    """Get graph data for 3D visualization."""
    tenant_id = "00000000-0000-0000-0000-000000000000"
    
    nodes_sql = text("""
        SELECT 
            id::text,
            kind::text,
            COALESCE(name, 'Node') as label,
            COALESCE(summary, '') as summary,
            COALESCE(pos_x, 0.0) as x,
            COALESCE(pos_y, 0.0) as y,
            COALESCE(pos_z, 0.0) as z,
            COALESCE(size, 1.0) as size,
            COALESCE(importance_score, 0.5) as importance,
            COALESCE(
                (SELECT COUNT(*) FROM edges_v2 WHERE src_id = nodes_v2.id OR dst_id = nodes_v2.id),
                0
            ) as degree,
            EXTRACT(EPOCH FROM created_at)::bigint as ts
        FROM nodes_v2
        WHERE tenant_id = :tenant_id
        ORDER BY importance_score DESC, created_at DESC
        LIMIT :limit_nodes
    """)
    
    edges_sql = text("""
        SELECT 
            src_id::text as source,
            dst_id::text as target,
            COALESCE(relation_name, edge_type::text) as rel,
            COALESCE(weight, 0.5) as weight,
            EXTRACT(EPOCH FROM created_at)::bigint as ts
        FROM edges_v2
        WHERE tenant_id = :tenant_id
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
            'x': row.x,
            'y': row.y,
            'z': row.z,
            'size': row.size,
            'importance': row.importance,
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

@router.get("/graph3d/test-data")
async def get_test_graph_data(
    node_count: int = Query(10000, description="Number of synthetic nodes to generate", ge=1000, le=1000000),
    edge_density: float = Query(0.01, description="Average edges per node", ge=0.001, le=100.0)
):
    """Generate synthetic graph data for stress testing viewport culling.
    
    WARNING: This endpoint generates large datasets in memory. Use for testing only.
    - node_count: Number of nodes (1k - 1M)
    - edge_density: Average edges per node (0.001 - 100.0)
    
    Generated data uses vectorized operations for fast generation.
    """
    import time
    import numpy as np
    start_time = time.time()
    
    # Use numpy for vectorized operations (much faster)
    clusters = min(20, node_count // 500)  # Scale clusters with node count
    nodes_per_cluster = node_count // clusters
    
    # Pre-generate cluster centers
    cluster_centers = np.column_stack([
        np.random.uniform(-5000, 5000, clusters),
        np.random.uniform(-5000, 5000, clusters)
    ])
    cluster_radii = np.random.uniform(200, 800, clusters)
    
    # Vectorized node generation
    nodes = []
    for cluster_idx in range(clusters):
        n = nodes_per_cluster if cluster_idx < clusters - 1 else node_count - len(nodes)
        
        # Vectorized angle and distance
        angles = np.random.uniform(0, 2 * np.pi, n)
        distances = np.abs(np.random.normal(0, cluster_radii[cluster_idx] / 2, n))
        distances = np.clip(distances, 0, cluster_radii[cluster_idx])
        
        # Calculate positions
        x = cluster_centers[cluster_idx, 0] + distances * np.cos(angles)
        y = cluster_centers[cluster_idx, 1] + distances * np.sin(angles)
        
        # Batch create nodes
        importance_vals = np.random.beta(2, 5, n)
        size_vals = np.random.uniform(0.5, 2.0, n)
        
        for i in range(n):
            nodes.append({
                'id': f"t{cluster_idx}_{i}",
                'kind': f'c{cluster_idx % 5}',
                'label': f'N{cluster_idx}-{i}',
                'summary': f'Test node {cluster_idx}',
                'x': float(x[i]),
                'y': float(y[i]),
                'z': 0.0,
                'size': float(size_vals[i]),
                'importance': float(importance_vals[i]),
                'degree': 0,
                'ts': int(time.time())
            })
    
    # Fast edge generation using numpy
    edges = []
    target_edges = int(node_count * edge_density)
    
    # Generate random edges
    source_indices = np.random.randint(0, len(nodes), target_edges * 2)  # Over-generate
    target_indices = np.random.randint(0, len(nodes), target_edges * 2)
    
    # Filter self-loops and duplicates
    seen = set()
    degree_count = {}
    
    for i in range(len(source_indices)):
        if len(edges) >= target_edges:
            break
            
        s_idx, t_idx = source_indices[i], target_indices[i]
        if s_idx == t_idx:
            continue
            
        edge_key = (s_idx, t_idx) if s_idx < t_idx else (t_idx, s_idx)
        if edge_key in seen:
            continue
            
        seen.add(edge_key)
        s_id, t_id = nodes[s_idx]['id'], nodes[t_idx]['id']
        
        edges.append({
            'source': s_id,
            'target': t_id,
            'rel': 'relates',
            'weight': float(np.random.beta(2, 5)),
            'ts': int(time.time())
        })
        
        degree_count[s_id] = degree_count.get(s_id, 0) + 1
        degree_count[t_id] = degree_count.get(t_id, 0) + 1
    
    # Update degrees
    for node in nodes:
        node['degree'] = degree_count.get(node['id'], 0)
    
    generation_time = time.time() - start_time
    avg_degree = sum(node['degree'] for node in nodes) / len(nodes) if nodes else 0
    
    return {
        'nodes': nodes,
        'edges': edges,
        'stats': {
            'node_count': len(nodes),
            'edge_count': len(edges),
            'window_minutes': 0,
            'generation_time_seconds': round(generation_time, 2),
            'test_mode': True,
            'clusters': clusters,
            'avg_degree': round(avg_degree, 2)
        }
    }
