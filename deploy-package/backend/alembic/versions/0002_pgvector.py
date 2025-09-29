"""enable pgvector and set embeddings.vec to Vector(dim)"""

from alembic import op
import sqlalchemy as sa
import os

# Fixed IDs for determinism
revision = "0002_pgvector"
down_revision = None  # set to your current head rev id if you have one
branch_labels = None
depends_on = None

# Read desired dimension from env (falls back to 384)
EMB_DIM = int(os.getenv("EMB_DIM", "384"))

def upgrade():
    # Ensure the extension exists
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # If embeddings table exists, enforce type vector(EMB_DIM)
    # Works whether the column already is 'vector' without length or another compatible type.
    op.execute(f"""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='embeddings' AND column_name='vec'
          ) THEN
            ALTER TABLE embeddings
              ALTER COLUMN vec TYPE vector({EMB_DIM});
          END IF;
        END$$;
    """)

def downgrade():
    # No safe automatic downgrade for pgvector dimension change; leave as-is.
    pass
