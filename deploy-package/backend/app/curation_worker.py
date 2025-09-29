
import os
from storage import SessionLocal
from kafka_bus import consumer, produce

GROUP = os.getenv("KAFKA_GROUP_ID","curation_worker")
CURATION_TOPIC = os.getenv("CURATION_TOPIC","curation.out")
GRAPH_EVENTS_TOPIC = os.getenv("GRAPH_EVENTS_TOPIC","graph.events")
_cons = None

def _ensure_consumer():
    global _cons
    if _cons is None:
        _cons = consumer([CURATION_TOPIC], group_id=GROUP, auto_offset_reset="latest", max_poll_records=100)
    return _cons

def step() -> bool:
    cons = _ensure_consumer()
    if cons is None: return False
    batch = cons.poll(timeout_ms=200, max_records=50) or []
    if not batch: return False
    processed = 0
    for msg in batch:
        payload = msg.value or {}
        if payload.get("type") != "edges.written":
            continue
        # hook for moderation/cleanup rules
        produce(GRAPH_EVENTS_TOPIC, {"type":"graph_curated","src_id":payload.get("src_id")})
        processed += 1
    return processed > 0
