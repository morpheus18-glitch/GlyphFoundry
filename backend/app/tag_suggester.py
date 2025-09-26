
import os, re
from sqlalchemy import text as T
from storage import SessionLocal
from kafka_bus import consumer, produce

GROUP = os.getenv("KAFKA_GROUP_ID","tag_suggester")
TAG_PROPOSALS = os.getenv("TAG_PROPOSALS_TOPIC","tags.proposals")
_cons = None
KEYWORDS = {"nlp":[r"\bnlp\b", r"\blanguage model", r"\btoken"], "vector":[r"\bvector", r"\bembedding", r"\bcosine"]}

def _ensure_consumer():
    global _cons
    if _cons is None:
        _cons = consumer(["nlp.candidates","curation.out"], group_id=GROUP, auto_offset_reset="latest", max_poll_records=100)
    return _cons

def step() -> bool:
    cons = _ensure_consumer()
    if cons is None: return False
    batch = cons.poll(timeout_ms=200, max_records=50) or []
    if not batch: return False
    processed=0
    for msg in batch:
        payload = msg.value or {}
        if payload.get("type") not in ("candidates.ready","edges.written"): continue
        node_id = payload.get("id") or payload.get("src_id")
        with SessionLocal() as db:
            row = db.execute(T("SELECT content FROM messages WHERE id=:id"), {"id": node_id}).first()
            text = (row[0] if row else "") or ""
        cands=[]
        for slug, pats in KEYWORDS.items():
            if any(re.search(p, text, flags=re.I) for p in pats):
                cands.append({"slug": slug, "confidence": 0.8})
        if cands:
            produce(TAG_PROPOSALS, {"version":"tag-protocol/1.0","op":"TAG_PROPOSE","actor":"rule:keywords","data":{"node_id": node_id, "candidates":cands}})
            processed+=1
    return processed>0
