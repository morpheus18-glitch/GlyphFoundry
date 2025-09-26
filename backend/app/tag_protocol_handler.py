
import os, uuid, re
from sqlalchemy import text as T
from storage import SessionLocal
from kafka_bus import consumer, produce

GROUP = os.getenv("KAFKA_GROUP_ID","tag_protocol")
TAG_PROPOSALS = os.getenv("TAG_PROPOSALS_TOPIC","tags.proposals")
TAG_DECISIONS = os.getenv("TAG_DECISIONS_TOPIC","tags.decisions")
GRAPH_EVENTS = os.getenv("GRAPH_EVENTS_TOPIC","graph.events")

_cons=None

def _slugify(name:str)->str:
    s=re.sub(r"[^a-z0-9]+","-",name.lower()).strip("-")
    return s or f"tag-{uuid.uuid4().hex[:8]}"

def _ensure_consumer():
    global _cons
    if _cons is None:
        _cons = consumer([TAG_PROPOSALS], group_id=GROUP, auto_offset_reset="latest", max_poll_records=100)
    return _cons

def step()->bool:
    cons=_ensure_consumer()
    if cons is None: return False
    batch = cons.poll(timeout_ms=200, max_records=50) or []
    if not batch: return False
    processed=0
    for msg in batch:
        payload=msg.value or {}
        if payload.get("version")!="tag-protocol/1.0": continue
        data=payload.get("data",{}); actor=payload.get("actor","protocol")
        node_id=data.get("node_id")
        cands=data.get("candidates",[])
        with SessionLocal() as db:
            for c in cands:
                if "tag_id" in c:
                    db.execute(T("""
                      INSERT INTO node_tags (node_id, tag_id, source, confidence, dedupe_key)
                      VALUES (:n,:t,:s,:c,:k)
                      ON CONFLICT (node_id, tag_id, source) DO UPDATE SET confidence=GREATEST(node_tags.confidence, EXCLUDED.confidence)
                    """), {"n":node_id,"t":c["tag_id"],"s":actor,"c":float(c.get("confidence",0.6)),"k":f"{node_id}:{c['tag_id']}:{actor}"})
                elif "slug" in c:
                    slug=c["slug"]
                    row=db.execute(T("SELECT id::text FROM tags WHERE slug=:s"),{"s":slug}).first()
                    if row: tag_id=row[0]
                    else:
                        row=db.execute(T("INSERT INTO tags (slug,name) VALUES (:s,:n) RETURNING id::text"),{"s":slug,"n":slug.replace("-"," ").title()}).first()
                        tag_id=row[0]
                    db.execute(T("""
                      INSERT INTO node_tags (node_id, tag_id, source, confidence, dedupe_key)
                      VALUES (:n,:t,:s,:c,:k)
                      ON CONFLICT (node_id, tag_id, source) DO UPDATE SET confidence=GREATEST(node_tags.confidence, EXCLUDED.confidence)
                    """), {"n":node_id,"t":tag_id,"s":actor,"c":float(c.get("confidence",0.6)),"k":f"{node_id}:{tag_id}:{actor}"})
            db.commit()
        produce(TAG_DECISIONS, {"op":"TAG_APPLY","node_id":node_id})
        produce(GRAPH_EVENTS, {"type":"tag_applied","node_id":node_id})
        processed+=1
    return processed>0
