
import os
from sqlalchemy import text as T
from sqlalchemy.orm import Session
from storage import SessionLocal
from kafka_bus import consumer, produce

GROUP = os.getenv("KAFKA_GROUP_ID","linker_worker")
CANDIDATES_TOPIC = os.getenv("CANDIDATES_TOPIC","nlp.candidates")
CURATION_TOPIC = os.getenv("CURATION_TOPIC","curation.out")
GRAPH_EVENTS_TOPIC = os.getenv("GRAPH_EVENTS_TOPIC","graph.events")
EMB_MODEL = os.getenv("EMB_MODEL","text-embedding-3-large@3072")

_cons = None

def _neighbors(db: Session, msg_id: str, k: int=8):
    rows = db.execute(T("""
      WITH q AS (
        SELECT vec FROM embeddings WHERE obj_type='message' AND obj_id=:id AND model=:m
      )
      SELECT e.obj_id::text AS id, 1 - (e.vec <=> (SELECT vec FROM q)) AS score
      FROM embeddings e JOIN q ON q.model=e.model
      WHERE e.obj_type='message' AND e.obj_id<>:id
      ORDER BY e.vec <=> (SELECT vec FROM q) LIMIT :k
    """), {"id": msg_id, "m":EMB_MODEL, "k":k}).mappings().all()
    return [(r["id"], float(r["score"])) for r in rows]

def _write_edge(db: Session, s, d, rel, w, model):
    db.execute(T("""
      INSERT INTO edges (src_id, dst_id, rel, weight, dedupe_key, created_at)
      VALUES (:s,:d,:r,:w,:k, now())
      ON CONFLICT (src_id, dst_id, rel, dedupe_key) DO NOTHING
    """), {"s":s,"d":d,"r":rel,"w":w,"k":f"{model}:{rel}:{s}:{d}"})

def _ensure_consumer():
    global _cons
    if _cons is None:
        _cons = consumer([CANDIDATES_TOPIC], group_id=GROUP, auto_offset_reset="latest", max_poll_records=100)
    return _cons

def step() -> bool:
    cons = _ensure_consumer()
    if cons is None:
        return False
    batch = cons.poll(timeout_ms=200, max_records=50) or []
    if not batch:
        return False
    processed = 0
    for msg in batch:
        payload = msg.value or {}
        if payload.get("type") != "candidates.ready":
            continue
        src_id = payload["id"]
        with SessionLocal() as db:
            for nbr, score in _neighbors(db, src_id, k=8):
                if score >= 0.60:
                    _write_edge(db, src_id, nbr, "similar_to", score, EMB_MODEL)
            db.commit()
        produce(CURATION_TOPIC, {"type":"edges.written","src_id":src_id})
        produce(GRAPH_EVENTS_TOPIC, {"type":"graph_delta"})
        processed += 1
    return processed > 0
