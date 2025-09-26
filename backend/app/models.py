from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector as VectorType
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, relationship

from settings import settings

Base = declarative_base()


class Glyph(Base):
    """Author-curated knowledge artifacts."""

    __tablename__ = "glyphs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (Index("ix_glyphs_created", "created_at"),)


class Message(Base):
    """Raw textual inputs that flow through the embedding/linking pipeline."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (Index("ix_messages_created", "created_at"),)


class Node(Base):
    """Unified graph node materialized via triggers from glyphs/messages."""

    __tablename__ = "nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (
        CheckConstraint("kind IN ('glyph','message')", name="nodes_kind_check"),
        Index("ix_nodes_kind_created", "kind", "created_at"),
    )


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dst_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    rel: Mapped[str | None] = mapped_column(String, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True, default=1.0)
    dedupe_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_edges_src", "src_id"),
        Index("ix_edges_dst", "dst_id"),
        Index("ix_edges_created", "created_at"),
        UniqueConstraint(
            "src_id",
            "dst_id",
            "rel",
            "dedupe_key",
            name="edges_src_dst_rel_dedupe_key_key",
        ),
    )


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obj_type: Mapped[str] = mapped_column(String, nullable=False)
    obj_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False, default=settings.emb_model)
    dim: Mapped[int] = mapped_column(Integer, nullable=False, default=settings.emb_dim)
    vec = Column(VectorType(dim=settings.emb_dim), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (
        UniqueConstraint("obj_type", "obj_id", "model", name="embeddings_obj_type_obj_id_model_key"),
        CheckConstraint("dim > 0", name="embeddings_dim_check"),
        CheckConstraint(
            "obj_type IN ('glyph','message')",
            name="embeddings_obj_type_check",
        ),
        Index("embeddings_obj_type", "obj_type"),
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dim: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vec = Column(VectorType(dim=settings.emb_dim), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (Index("ix_tags_slug", "slug"),)


class TagLink(Base):
    __tablename__ = "tag_links"

    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    child_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String, primary_key=True, default="is_a")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    parent: Mapped["Tag"] = relationship("Tag", foreign_keys=[parent_id])
    child: Mapped["Tag"] = relationship("Tag", foreign_keys=[child_id])


class NodeTag(Base):
    __tablename__ = "node_tags"

    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    source: Mapped[str] = mapped_column(String, primary_key=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    dedupe_key: Mapped[str | None] = mapped_column(String, nullable=True)

    tag: Mapped["Tag"] = relationship("Tag")

    __table_args__ = (
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="node_tags_confidence_check"),
        UniqueConstraint("node_id", "tag_id", "source", name="node_tags_node_tag_source_key"),
        UniqueConstraint("node_id", "tag_id", "dedupe_key", name="node_tags_dedupe_key_key"),
        Index("ix_node_tags_node", "node_id"),
        Index("ix_node_tags_tag", "tag_id"),
    )


class GraphCoord(Base):
    __tablename__ = "graph_coords"

    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True
    )
    layout: Mapped[str] = mapped_column(String, nullable=False, default="auto")
    x: Mapped[float | None] = mapped_column(Float, nullable=True)
    y: Mapped[float | None] = mapped_column(Float, nullable=True)
    z: Mapped[float | None] = mapped_column(Float, nullable=True)
    t: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (Index("ix_graph_coords_layout", "layout"),)
