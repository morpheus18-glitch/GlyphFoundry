from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship

# import settings for emb_dim
from settings import settings

# pgvector Vector type (required at runtime & for alembic rendering)
from pgvector.sqlalchemy import Vector as VectorType

Base = declarative_base()

# --- Tables ---

class Glyph(Base):
    __tablename__ = "glyphs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String, nullable=False)          # e.g., 'message','entity','tag'
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_glyphs_kind_created", "kind", "created_at"),
    )

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g., 'ingest','api'
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_messages_created", "created_at"),
    )

class Embedding(Base):
    __tablename__ = "embeddings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obj_type: Mapped[str] = mapped_column(String, nullable=False)      # 'glyph' | 'message'
    obj_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False, default="text-embedding-3-large")
    dim: Mapped[int] = mapped_column(Integer, nullable=False, default=settings.emb_dim)
    # pgvector column with tunable dimension
    vec = Column(VectorType(dim=settings.emb_dim), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("obj_type", "obj_id", "model", name="embeddings_obj_type_obj_id_model_key"),
        CheckConstraint("dim > 0", name="embeddings_dim_check"),
        CheckConstraint("obj_type in ('glyph','message')", name="embeddings_obj_type_check"),
        Index("embeddings_obj_type", "obj_type"),
    )

class Edge(Base):
    __tablename__ = "edges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dst_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # e.g., 'semantic','reference','tag'
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_edges_src_kind", "src_id", "kind"),
        Index("ix_edges_dst_kind", "dst_id", "kind"),
    )

class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("tags.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    parent: Mapped["Tag | None"] = relationship("Tag", remote_side=[id])

    __table_args__ = (
        Index("ix_tags_name", "name"),
    )
