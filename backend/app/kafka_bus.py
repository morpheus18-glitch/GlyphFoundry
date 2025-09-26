
import os, json, threading
from typing import Optional, Iterable
from kafka import KafkaProducer, KafkaConsumer

BROKERS = os.getenv("KAFKA_BROKERS")
CLIENT_ID = os.getenv("KAFKA_CLIENT_ID","gf_app")
_producer = None
_lock = threading.Lock()
_err = None

def _init():
    global _producer, _err
    if not BROKERS: return
    try:
        _producer = KafkaProducer(
            bootstrap_servers=BROKERS.split(","),
            client_id=CLIENT_ID,
            acks="all", retries=5, linger_ms=10,
            value_serializer=lambda v: json.dumps(v).encode("utf-8")
        )
    except Exception as e:
        _err = e
        _producer = None

def bus_health():
    return {"enabled": bool(BROKERS), "brokers": BROKERS, "producer_ok": _producer is not None, "error": str(_err) if _err else None}

def produce(topic:str, payload:dict, key:Optional[str]=None) -> bool:
    if not BROKERS: return True
    global _producer
    if _producer is None and _err is None:
        with _lock:
            if _producer is None and _err is None: _init()
    if _producer is None: return False
    try:
        _producer.send(topic, value=payload, key=(key.encode() if key else None))
        return True
    except Exception:
        return False

def consumer(topics:Iterable[str], group_id:str, **kw):
    if not BROKERS: return None
    return KafkaConsumer(
        *topics, bootstrap_servers=BROKERS.split(","),
        group_id=group_id, client_id=f"{CLIENT_ID}.{group_id}",
        enable_auto_commit=True, auto_offset_reset=kw.get("auto_offset_reset","latest"),
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        max_poll_records=kw.get("max_poll_records", 100),
        consumer_timeout_ms=kw.get("consumer_timeout_ms", 30000),
    )
