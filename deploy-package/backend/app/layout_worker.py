
import os, numpy as np
from sqlalchemy import text as T
from sklearn.decomposition import PCA
from storage import SessionLocal
from kafka_bus import consumer

GROUP = os.getenv("KAFKA_GROUP_ID","layout_worker")
GRAPH_EVENTS = os.getenv("GRAPH_EVENTS_TOPIC","graph.events")
LAYOUT = os.getenv("LAYOUT","pca")
EMB_MODEL = os.getenv("EMB_MODEL","text-embedding-3-large@3072")

_cons=None

def _fetch_vectors(db):
    rows = db.execute(T("""
      SELECT n.id::text id, e.vec
      FROM nodes n
      JOIN embeddings e ON e.obj_type=n.kind AND e.obj_id=n.id AND e.model=:m
      LIMIT 5000
    """), {"m": EMB_MODEL}).fetchall()
    ids=[r[0] for r in rows]
    X=np.vstack([np.array(r[1],dtype=np.float32) for r in rows]) if rows else np.zeros((0,3),dtype=np.float32)
    return ids, X

def _write_coords(db, ids, coords):
    for i, nid in enumerate(ids):
        x,y,z = (float(coords[i,0]), float(coords[i,1]), float(coords[i,2]))
        db.execute(T("""
          INSERT INTO graph_coords (node_id, layout, x, y, z, t, updated_at)
          VALUES (:id,:l,:x,:y,:z, EXTRACT(EPOCH FROM now()), now())
          ON CONFLICT (node_id) DO UPDATE
            SET layout=:l, x=:x, y=:y, z=:z, t=EXCLUDED.t, updated_at=now()
        """), {"id":nid,"l":LAYOUT,"x":x,"y":y,"z":z})

def step()->bool:
    global _cons
    if _cons is None:
        _cons = consumer([GRAPH_EVENTS], group_id=GROUP, auto_offset_reset="latest", max_poll_records=20)
    if _cons is None: return False
    batch = _cons.poll(timeout_ms=300, max_records=10) or []
    if not batch: return False
    with SessionLocal() as db:
        ids, X = _fetch_vectors(db)
        if len(ids) >= 3:
            pca=PCA(n_components=3, random_state=42)
            coords=pca.fit_transform(X)
            _write_coords(db, ids, coords)
            db.commit()
    return True
