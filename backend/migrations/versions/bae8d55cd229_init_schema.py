"""init schema

Revision ID: bae8d55cd229
Revises: 
Create Date: 2025-09-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "bae8d55cd229"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add `kind` column as nullable with default to avoid NOT NULL issues
    op.add_column(
        "edges",
        sa.Column("kind", sa.String(), nullable=True, server_default=sa.text("'unknown'"))
    )
    # Backfill existing rows
    op.execute("UPDATE edges SET kind = COALESCE(kind, 'unknown')")
    # Enforce NOT NULL and drop server_default
    op.alter_column("edges", "kind", existing_type=sa.String(), nullable=False, server_default=None)


def downgrade() -> None:
    op.drop_column("edges", "kind")
