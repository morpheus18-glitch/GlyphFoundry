from sqlalchemy import text

SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tags (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS node_tags (
  node_id    uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  confidence double precision,
  PRIMARY KEY (node_id, tag_id)
);
"""

def ensure_min_schema(db):
    db.execute(text(SQL))
    db.commit()
