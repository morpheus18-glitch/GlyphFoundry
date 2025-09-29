from __future__ import annotations

import os
from typing import Dict, List

import numpy as np
from sqlalchemy import text as T
from sqlalchemy.orm import Session

from kafka_bus import consumer, produce
from services.embeddings import embed_texts
from storage import SessionLocal

GROUP = os.getenv("KAFKA_GROUP_ID", "nlp_extract")
INGEST_TOPIC = os.getenv("INGEST_TOPIC", "nlp.ingest")
CANDIDATES_TOPIC = os.getenv("CANDIDATES_TOPIC", "nlp.candidates")
EMB_MODEL = os.getenv("EMB_MODEL", "text-embedding-3-large@3072")
EMB_BACKEND = os.getenv("EMB_MODEL_BACKEND", "sentence-transformers/all-MiniLM-L6-v2")
EMB_DIM = int(os.getenv("EMB_DIM", "384"))

_consumer = None


def _ensure_consumer():
    global _consumer
    if _consumer is None:
        _consumer = consumer(
            [INGEST_TOPIC],
            group_id=GROUP,
            auto_offset_reset=os.getenv("AUTO_OFFSET_RESET", "earliest"),
            max_poll_records=int(os.getenv("MAX_POLL_RECORDS", "128")),
        )
    return _consumer


def _flatten_batch(batch: Dict) -> List:
    records: List = []
    for msgs in batch.values():
        records.extend(msgs)
    return records


def _upsert_embedding(db: Session, obj_type: str, obj_id: str, vec: np.ndarray):
    payload = vec.astype(np.float32).tolist()
    db.execute(
        T(
            """
            INSERT INTO embeddings (obj_type, obj_id, model, dim, vec)
            VALUES (:obj_type, :obj_id, :model, :dim, :vec)
            ON CONFLICT (obj_type, obj_id, model)
            DO UPDATE SET vec = EXCLUDED.vec, dim = EXCLUDED.dim, created_at = now()
            """
        ),
        {
            "obj_type": obj_type,
            "obj_id": obj_id,
            "model": EMB_MODEL,
            "dim": vec.shape[0],
            "vec": payload,
        },
    )


def step() -> bool:
    cons = _ensure_consumer()
    if cons is None:
        return False

    batch = cons.poll(timeout_ms=500, max_records=200) or {}
    records = _flatten_batch(batch)
    if not records:
        return False

    events = []
    for record in records:
        payload = getattr(record, "value", None) or {}
        if payload.get("type") != "message.created":
            continue
        message_id = payload.get("id")
        content = (payload.get("content") or "").strip()
        if not message_id or not content:
            continue
        events.append((message_id, content))

    if not events:
        return False

    vectors = embed_texts([content for _, content in events], EMB_BACKEND)
    if vectors.shape[1] != EMB_DIM:
        raise RuntimeError(
            f"Embedding dimension mismatch: expected {EMB_DIM}, got {vectors.shape[1]} for model {EMB_BACKEND}"
        )

    with SessionLocal() as db:
        for (message_id, _), vector in zip(events, vectors):
            _upsert_embedding(db, "message", message_id, vector)
        db.commit()

    for message_id, _ in events:
        produce(
            CANDIDATES_TOPIC,
            {"type": "candidates.ready", "id": message_id, "model": EMB_MODEL},
            key=message_id,
        )

    return True
