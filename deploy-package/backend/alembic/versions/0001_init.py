from alembic import op
import sqlalchemy as sa

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        "nodes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("name", sa.Text),
        sa.Column("summary", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_check_constraint("nodes_kind_check", "nodes", "kind = ANY (ARRAY['glyph','message','person']::text[])")

    op.create_table(
        "edges",
        sa.Column("src_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dst_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rel", sa.Text, nullable=False),
        sa.Column("weight", sa.Float),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_primary_key("edges_pkey", "edges", ["src_id","dst_id","rel","created_at"])
    op.create_foreign_key("edges_src_fkey","edges","nodes",["src_id"],["id"],ondelete="CASCADE")
    op.create_foreign_key("edges_dst_fkey","edges","nodes",["dst_id"],["id"],ondelete="CASCADE")

    op.create_table(
        "tags",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
    )

    op.create_table(
        "node_tags",
        sa.Column("node_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("confidence", sa.Float),
        sa.PrimaryKeyConstraint("node_id","tag_id"),
        sa.ForeignKeyConstraint(["node_id"],["nodes.id"],ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"],["tags.id"],ondelete="CASCADE"),
    )

    # Embeddings
    op.create_table(
        "embeddings",
        sa.Column("entity_id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.Text, nullable=False),  # 'node'|'message'
        sa.Column("dim", sa.Integer, nullable=False),
        sa.Column("vec", sa.dialects.postgresql.ARRAY(sa.Float), nullable=False),  # store as array; optional: use pgvector in app
        sa.Column("model", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Tag protocol
    op.create_table(
        "tag_signals",
        sa.Column("tag_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("node_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal", sa.Float, nullable=False),
        sa.Column("source", sa.Text, nullable=False),
        sa.Column("ts", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_tag_signals_tag_ts", "tag_signals", ["tag_id","ts"])

    op.create_table(
        "tag_state",
        sa.Column("tag_id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("status", sa.Text, nullable=False, server_default=sa.text("'active'")),
        sa.Column("version", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("params", sa.dialects.postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "tag_membership",
        sa.Column("node_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("assigned_by", sa.Text, nullable=False),
        sa.Column("ts", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("node_id","tag_id"),
    )

    # 3D layout cache
    op.create_table(
        "node_layout",
        sa.Column("node_id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("layout", sa.Text, nullable=False, server_default=sa.text("'pca'")),
        sa.Column("x", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("y", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("z", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("ts", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

def downgrade():
    for t in ["node_layout","tag_membership","tag_state","tag_signals","embeddings","node_tags","tags","edges","nodes"]:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE;")
