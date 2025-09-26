CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS node_tags (
  node_id    uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  confidence double precision NOT NULL DEFAULT 0.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, tag_id)
);
