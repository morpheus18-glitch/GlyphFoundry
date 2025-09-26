
import os, numpy as np
from sqlalchemy import text as T
from sqlalchemy.orm import Session
from storage import SessionLocal
from kafka_bus import consumer, produce

GROUP = os.getenv("KAFKA_GROUP_ID","nlp_extract")
INGEST_TOPIC = os.getenv("INGEST_TOPIC","nlp.ingest")
CANDIDATES_TOPIC = os.getenv("CANDIDATES_TOPIC","nlp.candidates")
EMB_MODEL = os.getenv("EMB_MODEL","text-embedding-3-large@3072")
EMB_DIM = int(os.getenv("EMB_DIM","384"))

_cons = None

def _embed_stub(text:str) -> list[float]:
    seed = abs(hash(text)) % (2**32)
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(EMB_DIM).astype(np.float32)
    v /= (np.linalg.norm(v) + 1e-8)
    return v.tolist()

def _upsert_embedding(db: Session, obj_type: str, obj_id: str, vec: list[float]):
    db.execute(T("""
      INSERT INTO embeddings (obj_type, obj_id, model, dim, vec)
      VALUES (:t,:id,:m,:d,:v)
      ON CONFLICT (obj_type, obj_id, model) DO UPDATE
        SET vec=EXCLUDED.vec, dim=EXCLUDED.dim, created_at=now()
    """), {"t":obj_type,"id":obj_id,"m":EMB_MODEL,"d":len(vec),"v":vec})

def _ensure_consumer():
    global _cons
    if _cons is None:
        _cons = consumer([INGEST_TOPIC], group_id=GROUP, auto_offset_reset="earliest", max_poll_records=100)
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
        if payload.get("type") != "message.created":
            continue
        msg_id = payload["id"]
        content = payload.get("content","")
        vec = _embed_stub(content)
        with SessionLocal() as db:
            _upsert_embedding(db, "message", msg_id, vec)
            db.commit()
        produce(CANDIDATES_TOPIC, {"type":"candidates.ready","id":msg_id})
        processed += 1
    return processed > 0
