from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam, Integer

def export_graph_json(db: Session, limit_nodes: int, limit_edges: int, window_minutes: int):
    sql = text("""
      WITH recent_edges AS (
        SELECT *
        FROM edges
        WHERE created_at >= (NOW() - (:w || ' minutes')::interval)
        ORDER BY created_at DESC
        LIMIT :le_seed
      ),
      node_ids AS (
        SELECT DISTINCT src_id AS id FROM recent_edges
        UNION
        SELECT DISTINCT dst_id FROM recent_edges
      ),
      picked_nodes AS (
        SELECT n.id, n.kind, COALESCE(n.name,'') AS label, COALESCE(n.summary,'') AS summary, n.created_at
        FROM nodes n
        JOIN node_ids s ON s.id = n.id
        ORDER BY n.created_at DESC
        LIMIT :ln
      ),
      picked_edges AS (
        SELECT e.src_id, e.dst_id, e.relation_name AS rel, COALESCE(e.weight,0.0) AS weight, e.created_at
        FROM edges e
        JOIN picked_nodes a ON a.id = e.src_id
        JOIN picked_nodes b ON b.id = e.dst_id
        ORDER BY e.created_at DESC
        LIMIT :le
      ),
      deg AS (
        SELECT id, COUNT(*)::int AS degree
        FROM (
          SELECT src_id AS id FROM picked_edges
          UNION ALL
          SELECT dst_id FROM picked_edges
        ) z
        GROUP BY id
      )
      SELECT jsonb_build_object(
        'nodes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', pn.id::text,
            'kind', pn.kind,
            'label', pn.label,
            'summary', pn.summary,
            'degree', COALESCE(d.degree,0),
            'ts', EXTRACT(EPOCH FROM pn.created_at)::bigint
          ))
          FROM picked_nodes pn
          LEFT JOIN deg d ON d.id = pn.id
        ), '[]'::jsonb),
        'edges', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'source', pe.src_id::text,
            'target', pe.dst_id::text,
            'rel', pe.rel,
            'weight', pe.weight,
            'ts', EXTRACT(EPOCH FROM pe.created_at)::bigint
          ))
          FROM picked_edges pe
        ), '[]'::jsonb),
        'stats', jsonb_build_object(
          'node_count', (SELECT COUNT(*) FROM picked_nodes),
          'edge_count', (SELECT COUNT(*) FROM picked_edges),
          'window_minutes', :w
        )
      ) AS payload;
    """).bindparams(
        bindparam("w", type_=Integer),
        bindparam("le_seed", type_=Integer),
        bindparam("ln", type_=Integer),
        bindparam("le", type_=Integer),
    )

    params = {
        "w": int(window_minutes),
        "le_seed": min(int(limit_edges), 5000),
        "ln": max(int(limit_nodes), 1),
        "le": max(int(limit_edges), 1),
    }

    row = db.execute(sql, params).first()
    return row[0] if row and row[0] else {
        "nodes": [],
        "edges": [],
        "stats": {"node_count": 0, "edge_count": 0, "window_minutes": window_minutes},
    }

def export_tags_json(db: Session):
    rows = db.execute(text("""
      SELECT t.id::text AS tag_id, t.slug, t.name, nt.node_id::text AS node_id, nt.confidence
      FROM node_tags nt
      JOIN tags t ON t.id = nt.tag_id
    """)).mappings().all()
    return {"items": [dict(r) for r in rows]}
