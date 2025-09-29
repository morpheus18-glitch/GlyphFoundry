
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS glyphs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nodes (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('glyph','message')),
  name text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS edges (
  id bigserial PRIMARY KEY,
  src_id uuid NOT NULL,
  dst_id uuid NOT NULL,
  rel text,
  weight double precision,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edges_src_idx ON edges (src_id);
CREATE INDEX IF NOT EXISTS edges_dst_idx ON edges (dst_id);
CREATE INDEX IF NOT EXISTS edges_created_idx ON edges (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS edges_dedupe ON edges (src_id, dst_id, rel, COALESCE(dedupe_key,'')) WHERE rel IS NOT NULL;

CREATE TABLE IF NOT EXISTS embeddings (
  id bigserial PRIMARY KEY,
  obj_type text NOT NULL CHECK (obj_type IN ('glyph','message')),
  obj_id uuid NOT NULL,
  model text NOT NULL,
  dim int NOT NULL CHECK (dim > 0),
  vec vector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obj_type, obj_id, model)
);
DO $$ BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx ON embeddings USING hnsw (vec vector_cosine_ops);
  EXCEPTION WHEN undefined_object THEN
    CREATE INDEX IF NOT EXISTS embeddings_ivfflat_idx ON embeddings USING ivfflat (vec vector_cosine_ops) WITH (lists=100);
  END;
END $$;
CREATE INDEX IF NOT EXISTS embeddings_obj_idx ON embeddings (obj_type, model);

CREATE OR REPLACE FUNCTION upsert_node_from_glyph() RETURNS trigger AS $$
BEGIN
  INSERT INTO nodes (id,kind,name,summary,created_at)
  VALUES (NEW.id,'glyph',COALESCE(NEW.name,''),COALESCE(NEW.summary,''),COALESCE(NEW.created_at,now()))
  ON CONFLICT (id) DO UPDATE
    SET kind='glyph',
        name=COALESCE(EXCLUDED.name,nodes.name),
        summary=COALESCE(EXCLUDED.summary,nodes.summary),
        created_at=LEAST(nodes.created_at, EXCLUDED.created_at);
  RETURN NEW;
END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_node_from_message() RETURNS trigger AS $$
BEGIN
  INSERT INTO nodes (id,kind,name,summary,created_at)
  VALUES (NEW.id,'message',left(COALESCE(NEW.content,''),120),COALESCE(NEW.summary,''),COALESCE(NEW.created_at,now()))
  ON CONFLICT (id) DO UPDATE
    SET kind='message',
        name=COALESCE(EXCLUDED.name,nodes.name),
        summary=COALESCE(EXCLUDED.summary,nodes.summary),
        created_at=LEAST(nodes.created_at, EXCLUDED.created_at);
  RETURN NEW;
END$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tr_upsert_nodes_from_glyph') THEN
    CREATE TRIGGER tr_upsert_nodes_from_glyph
    AFTER INSERT OR UPDATE ON glyphs
    FOR EACH ROW EXECUTE FUNCTION upsert_node_from_glyph();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tr_upsert_nodes_from_message') THEN
    CREATE TRIGGER tr_upsert_nodes_from_message
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION upsert_node_from_message();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  dim int,
  vec vector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tag_links (
  parent_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  child_id  uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'is_a',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id, kind)
);

CREATE TABLE IF NOT EXISTS node_tags (
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source  text NOT NULL,
  confidence real NOT NULL CHECK (confidence>=0 AND confidence<=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text,
  PRIMARY KEY (node_id, tag_id, source),
  UNIQUE (node_id, tag_id, COALESCE(dedupe_key,''))
);
CREATE INDEX IF NOT EXISTS node_tags_node_idx ON node_tags (node_id);
CREATE INDEX IF NOT EXISTS node_tags_tag_idx  ON node_tags (tag_id);

CREATE TABLE IF NOT EXISTS tag_rules (
  id bigserial PRIMARY KEY,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  kind text NOT NULL,
  pattern text,
  threshold real,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tag_events (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS graph_coords (
  node_id uuid PRIMARY KEY,
  layout text NOT NULL DEFAULT 'auto',
  x double precision, y double precision, z double precision, t double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graph_coords_layout_idx ON graph_coords (layout);
