from __future__ import annotations

from datetime import datetime
from collections import defaultdict
from typing import Dict, Iterable, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from db import get_db
from kafka_bus import bus_health, produce
from models import Message, NodeTag, Tag
from settings import settings

router = APIRouter()


class TagAssignment(BaseModel):
    slug: str
    name: str
    confidence: float


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, description="Body of the message to ingest")
    author: str | None = Field(default=None, description="Optional author handle")
    source: str | None = Field(default="api", description="Provenance identifier")
    summary: str | None = Field(default=None, description="Optional short summary")
    tags: List[str] = Field(default_factory=list, description="Optional tag slugs to apply")


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content: str
    author: str | None
    source: str | None
    summary: str | None
    created_at: datetime
    tags: List[TagAssignment] = Field(default_factory=list)


@router.get("/busz")
def bus_status():
    """Expose Kafka wiring so operators can validate connectivity."""

    return bus_health()


def _persist_tags(db: Session, message_id: UUID, slugs: List[str]) -> None:
    if not slugs:
        return

    normalized = []
    for slug in slugs:
        cleaned = slug.strip().lower()
        if not cleaned:
            continue
        normalized.append(cleaned)

    if not normalized:
        return

    existing = {
        row.slug: row
        for row in db.scalars(select(Tag).where(Tag.slug.in_(normalized)))
    }

    created_ids: dict[str, UUID] = {}
    for slug in normalized:
        tag = existing.get(slug)
        if tag is None:
            tag = Tag(slug=slug, name=slug.replace("-", " ").title())
            db.add(tag)
            db.flush()
            existing[slug] = tag
        created_ids[slug] = tag.id

    for slug, tag_id in created_ids.items():
        db.execute(
            text(
                """
                INSERT INTO node_tags (node_id, tag_id, source, confidence, dedupe_key)
                VALUES (:node_id, :tag_id, :source, :confidence, :dedupe_key)
                ON CONFLICT (node_id, tag_id, source)
                DO UPDATE SET confidence = GREATEST(node_tags.confidence, EXCLUDED.confidence)
                """
            ),
            {
                "node_id": str(message_id),
                "tag_id": str(tag_id),
                "source": "api",
                "confidence": 0.9,
                "dedupe_key": f"{message_id}:{tag_id}:api",
            },
        )

def _tag_map(db: Session, message_ids: Iterable[UUID]) -> Dict[UUID, List[TagAssignment]]:
    ids = [mid for mid in message_ids]
    if not ids:
        return {}

    rows = db.execute(
        select(NodeTag.node_id, Tag.slug, Tag.name, NodeTag.confidence)
            .join(Tag, Tag.id == NodeTag.tag_id)
            .where(NodeTag.node_id.in_(ids))
            .order_by(Tag.slug)
    )

    mapping: Dict[UUID, List[TagAssignment]] = defaultdict(list)
    for node_id, slug, name, confidence in rows:
        mapping[node_id].append(
            TagAssignment(slug=slug, name=name, confidence=float(confidence or 0.0))
        )
    return mapping


def _message_response(message: Message, tags: List[TagAssignment]) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        content=message.content,
        author=message.author,
        source=message.source,
        summary=message.summary,
        created_at=message.created_at,
        tags=tags,
    )


@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(payload: MessageCreate, db: Session = Depends(get_db)):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "content cannot be blank")

    summary = payload.summary or content.splitlines()[0][:240]

    message = Message(
        content=content,
        author=payload.author,
        source=payload.source or "api",
        summary=summary,
    )
    db.add(message)
    db.flush()

    _persist_tags(db, message.id, payload.tags)

    event = {
        "type": "message.created",
        "id": str(message.id),
        "source": message.source,
        "author": message.author,
        "content": message.content,
        "summary": message.summary,
        "created_at": message.created_at.isoformat(),
        "tags": payload.tags,
    }

    dispatched = produce(settings.kafka.ingest_topic, event, key=str(message.id))
    if not dispatched:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Unable to dispatch ingest event")

    produce(settings.kafka.graph_events_topic, {"type": "message.ingested", "id": str(message.id)})

    tag_lookup = _tag_map(db, [message.id])
    return _message_response(message, tag_lookup.get(message.id, []))


@router.get("/messages/{message_id}", response_model=MessageResponse)
def read_message(message_id: UUID, db: Session = Depends(get_db)):
    message = db.get(Message, message_id)
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    tag_lookup = _tag_map(db, [message.id])
    return _message_response(message, tag_lookup.get(message.id, []))


@router.get("/messages", response_model=list[MessageResponse])
def list_messages(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    messages = db.scalars(
        select(Message).order_by(Message.created_at.desc()).limit(limit)
    ).all()
    tag_lookup = _tag_map(db, [m.id for m in messages])
    return [_message_response(message, tag_lookup.get(message.id, [])) for message in messages]
