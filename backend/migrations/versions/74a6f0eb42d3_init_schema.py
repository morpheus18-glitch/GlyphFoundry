"""init schema

Revision ID: 74a6f0eb42d3
Revises: bae8d55cd229
Create Date: 2023-09-23 13:11:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '74a6f0eb42d3'
down_revision = 'bae8d55cd229'
branch_labels = None
depends_on = None

def upgrade():
    # Idempotent column addition
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='tags' AND column_name='created_at'
        ) THEN
            ALTER TABLE tags ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
    END $$;
    """)

def downgrade():
    op.drop_column('tags', 'created_at')
