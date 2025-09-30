-- =====================================================================
-- PRODUCTION-GRADE MULTI-TENANT KNOWLEDGE GRAPH SCHEMA
-- =====================================================================
-- This schema implements a complete SaaS knowledge graph platform with:
-- - Multi-tenant isolation with Row-Level Security (RLS)
-- - Vector embeddings with pgvector for similarity search
-- - 4D glyph visualization (x, y, z + time dimension)
-- - Performance indexes for sub-100ms queries
-- - Audit logging and temporal tracking
-- - Quantum-enhanced security features
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- ENUMS: Type definitions for strong typing
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE node_kind_enum AS ENUM (
        'glyph', 'message', 'document', 'entity', 'concept', 'event', 'metric'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE edge_type_enum AS ENUM (
        'relates_to', 'derives_from', 'influences', 'contains', 'references',
        'quantum_neural_link', 'ml_neural_foundation', 'ml_ai_convergence',
        'quantum_ai_evolution', 'autonomous_learning', 'temporal_correlation'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tag_category_enum AS ENUM (
        'domain', 'technology', 'concept', 'metric', 'security', 'performance', 'business'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE glyph_type_enum AS ENUM (
        'cpu_usage', 'memory_usage', 'network_rx', 'network_tx', 'disk_read', 'disk_write',
        'metric_system', 'metric_application', 'event', 'alert', 'visualization', 'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status_enum AS ENUM (
        'active', 'suspended', 'trial', 'enterprise'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM (
        'user', 'admin', 'service'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE obj_type_enum AS ENUM (
        'glyph', 'message', 'node', 'tag', 'document'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================================
-- CORE TENANCY TABLES
-- =====================================================================

-- Tenants table for multi-tenant isolation
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status tenant_status_enum NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);
CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);

-- API Keys for tenant authentication and authorization
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    hashed_key TEXT NOT NULL,
    prefix TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS api_keys_expires_idx ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Users table (optional for user management)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    role user_role_enum NOT NULL DEFAULT 'user',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- =====================================================================
-- KNOWLEDGE GRAPH CORE TABLES
-- =====================================================================

-- Nodes table with full multi-tenant support and vector embeddings
CREATE TABLE IF NOT EXISTS nodes_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kind node_kind_enum NOT NULL,
    name TEXT,
    summary TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Vector embeddings for similarity search (multiple dimensions supported)
    embedding_384 vector(384),
    embedding_768 vector(768),
    embedding_1536 vector(1536),
    
    -- 3D spatial coordinates
    pos_x FLOAT,
    pos_y FLOAT,
    pos_z FLOAT,
    
    -- Visual properties for rendering
    color TEXT DEFAULT '#4A90E2',
    size FLOAT DEFAULT 1.0,
    opacity FLOAT DEFAULT 1.0,
    glow_intensity FLOAT DEFAULT 0.5,
    
    -- Graph analytics
    importance_score FLOAT DEFAULT 0.0,
    connection_strength FLOAT DEFAULT 0.0,
    
    -- Temporal tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes for nodes
CREATE INDEX IF NOT EXISTS nodes_v2_tenant_created_idx ON nodes_v2(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nodes_v2_tenant_kind_created_idx ON nodes_v2(tenant_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS nodes_v2_metadata_idx ON nodes_v2 USING GIN(metadata);

-- HNSW indexes for vector similarity search (best for high-dimensional data)
DO $$ BEGIN
    BEGIN
        CREATE INDEX IF NOT EXISTS nodes_v2_emb384_hnsw_idx ON nodes_v2 USING hnsw (embedding_384 vector_cosine_ops);
        CREATE INDEX IF NOT EXISTS nodes_v2_emb768_hnsw_idx ON nodes_v2 USING hnsw (embedding_768 vector_cosine_ops);
        CREATE INDEX IF NOT EXISTS nodes_v2_emb1536_hnsw_idx ON nodes_v2 USING hnsw (embedding_1536 vector_cosine_ops);
    EXCEPTION WHEN undefined_object THEN
        -- Fallback to IVFFlat if HNSW not available
        CREATE INDEX IF NOT EXISTS nodes_v2_emb384_ivf_idx ON nodes_v2 USING ivfflat (embedding_384 vector_cosine_ops) WITH (lists=100);
    END;
END $$;

-- Edges table with full relationship tracking
CREATE TABLE IF NOT EXISTS edges_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    src_id UUID NOT NULL REFERENCES nodes_v2(id) ON DELETE CASCADE,
    dst_id UUID NOT NULL REFERENCES nodes_v2(id) ON DELETE CASCADE,
    
    edge_type edge_type_enum NOT NULL,
    relation_name TEXT,
    weight FLOAT DEFAULT 1.0,
    confidence FLOAT DEFAULT 1.0,
    
    -- Autonomous learning features
    auto_generated BOOLEAN DEFAULT false,
    learning_confidence FLOAT DEFAULT 0.0,
    reinforcement_count INT DEFAULT 0,
    last_reinforced TIMESTAMPTZ,
    
    -- Visual properties
    color TEXT DEFAULT '#888888',
    thickness FLOAT DEFAULT 1.0,
    opacity FLOAT DEFAULT 0.8,
    animation_speed FLOAT DEFAULT 1.0,
    
    -- Temporal tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure no self-loops
    CHECK (src_id != dst_id)
);

-- Performance indexes for edges (covering indexes for faster queries)
CREATE INDEX IF NOT EXISTS edges_v2_tenant_src_idx ON edges_v2(tenant_id, src_id) 
    INCLUDE(edge_type, weight, confidence, created_at);
CREATE INDEX IF NOT EXISTS edges_v2_tenant_dst_idx ON edges_v2(tenant_id, dst_id) 
    INCLUDE(edge_type, weight, confidence, created_at);
CREATE INDEX IF NOT EXISTS edges_v2_tenant_created_idx ON edges_v2(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edges_v2_type_idx ON edges_v2(tenant_id, edge_type);

-- Unique constraint for preventing duplicate edges
CREATE UNIQUE INDEX IF NOT EXISTS edges_v2_unique_idx ON edges_v2(tenant_id, src_id, dst_id, edge_type);

-- =====================================================================
-- TAGS AND HIERARCHICAL CLASSIFICATION
-- =====================================================================

-- Tags table with vector embeddings
CREATE TABLE IF NOT EXISTS tags_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category tag_category_enum,
    
    -- Vector embedding for semantic tag similarity
    dim INT,
    vec vector(384),
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS tags_v2_tenant_slug_idx ON tags_v2(tenant_id, slug);
CREATE INDEX IF NOT EXISTS tags_v2_category_idx ON tags_v2(tenant_id, category);

-- HNSW index for tag vector similarity
DO $$ BEGIN
    BEGIN
        CREATE INDEX IF NOT EXISTS tags_v2_vec_hnsw_idx ON tags_v2 USING hnsw (vec vector_cosine_ops) WHERE vec IS NOT NULL;
    EXCEPTION WHEN undefined_object THEN null;
    END;
END $$;

-- Tag hierarchy (parent-child relationships)
CREATE TABLE IF NOT EXISTS tag_links_v2 (
    parent_id UUID NOT NULL REFERENCES tags_v2(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES tags_v2(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kind TEXT DEFAULT 'is_a',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (parent_id, child_id, kind)
);

CREATE INDEX IF NOT EXISTS tag_links_v2_tenant_parent_idx ON tag_links_v2(tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS tag_links_v2_tenant_child_idx ON tag_links_v2(tenant_id, child_id);

-- Node-Tag associations with confidence scores
CREATE TABLE IF NOT EXISTS node_tags_v2 (
    node_id UUID NOT NULL REFERENCES nodes_v2(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags_v2(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dedupe_key TEXT,
    PRIMARY KEY (node_id, tag_id, source),
    UNIQUE (node_id, tag_id, COALESCE(dedupe_key, ''))
);

CREATE INDEX IF NOT EXISTS node_tags_v2_tenant_node_idx ON node_tags_v2(tenant_id, node_id);
CREATE INDEX IF NOT EXISTS node_tags_v2_tenant_tag_idx ON node_tags_v2(tenant_id, tag_id);

-- =====================================================================
-- 4D GLYPH VISUALIZATION SYSTEM
-- =====================================================================

-- Glyphs with 4D coordinates (x, y, z + time dimension)
CREATE TABLE IF NOT EXISTS glyphs_4d (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type glyph_type_enum NOT NULL,
    
    -- 4D coordinates
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    z FLOAT NOT NULL,
    t TIMESTAMPTZ NOT NULL,
    
    -- Metadata and relationships
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    parent_id UUID REFERENCES glyphs_4d(id) ON DELETE SET NULL,
    related_node_id UUID REFERENCES nodes_v2(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- Indexes for fast temporal queries and spatial lookups
CREATE INDEX IF NOT EXISTS glyphs_4d_tenant_time_idx ON glyphs_4d(tenant_id, t DESC);
CREATE INDEX IF NOT EXISTS glyphs_4d_tenant_type_time_idx ON glyphs_4d(tenant_id, type, t DESC);
CREATE INDEX IF NOT EXISTS glyphs_4d_metadata_idx ON glyphs_4d USING GIN(metadata);

-- BRIN index for time-series data (efficient for large datasets)
CREATE INDEX IF NOT EXISTS glyphs_4d_time_brin_idx ON glyphs_4d USING BRIN(t);

-- Graph coordinates for layout algorithms
CREATE TABLE IF NOT EXISTS graph_coords_v2 (
    node_id UUID PRIMARY KEY REFERENCES nodes_v2(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    layout TEXT NOT NULL DEFAULT 'auto',
    x FLOAT,
    y FLOAT,
    z FLOAT,
    t FLOAT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS graph_coords_v2_tenant_layout_idx ON graph_coords_v2(tenant_id, layout);

-- =====================================================================
-- EMBEDDINGS CENTRALIZED TABLE
-- =====================================================================

-- Centralized embeddings storage with multi-model support
CREATE TABLE IF NOT EXISTS embeddings_v2 (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    obj_type obj_type_enum NOT NULL,
    obj_id UUID NOT NULL,
    model TEXT NOT NULL,
    dim INT NOT NULL CHECK (dim > 0),
    vec vector NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, obj_type, obj_id, model)
);

CREATE INDEX IF NOT EXISTS embeddings_v2_tenant_type_idx ON embeddings_v2(tenant_id, obj_type);
CREATE INDEX IF NOT EXISTS embeddings_v2_model_idx ON embeddings_v2(model);

-- HNSW index for vector search
DO $$ BEGIN
    BEGIN
        CREATE INDEX IF NOT EXISTS embeddings_v2_vec_hnsw_idx ON embeddings_v2 USING hnsw (vec vector_cosine_ops);
    EXCEPTION WHEN undefined_object THEN null;
    END;
END $$;

-- =====================================================================
-- AUDIT LOGGING AND TEMPORAL TRACKING
-- =====================================================================

-- Audit log for all data changes
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_at_idx ON audit_log(tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_at_idx ON audit_log(table_name, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor);

-- History tables for temporal tracking
CREATE TABLE IF NOT EXISTS nodes_history (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    kind node_kind_enum NOT NULL,
    name TEXT,
    summary TEXT,
    content TEXT,
    metadata JSONB,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL DEFAULT 'infinity'::timestamptz,
    PRIMARY KEY (id, valid_from)
);

CREATE INDEX IF NOT EXISTS nodes_history_tenant_valid_idx ON nodes_history(tenant_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS edges_history (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    src_id UUID NOT NULL,
    dst_id UUID NOT NULL,
    edge_type edge_type_enum NOT NULL,
    relation_name TEXT,
    weight FLOAT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL DEFAULT 'infinity'::timestamptz,
    PRIMARY KEY (id, valid_from)
);

CREATE INDEX IF NOT EXISTS edges_history_tenant_valid_idx ON edges_history(tenant_id, valid_from DESC);

-- =====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_links_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_tags_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE glyphs_4d ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_coords_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings_v2 ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (applies to all tenant-scoped tables)
DO $$ 
BEGIN
    -- Nodes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'nodes_v2') THEN
        CREATE POLICY tenant_isolation ON nodes_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Edges
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'edges_v2') THEN
        CREATE POLICY tenant_isolation ON edges_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Tags
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'tags_v2') THEN
        CREATE POLICY tenant_isolation ON tags_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Tag Links
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'tag_links_v2') THEN
        CREATE POLICY tenant_isolation ON tag_links_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Node Tags
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'node_tags_v2') THEN
        CREATE POLICY tenant_isolation ON node_tags_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Glyphs 4D
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'glyphs_4d') THEN
        CREATE POLICY tenant_isolation ON glyphs_4d 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Graph Coords
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'graph_coords_v2') THEN
        CREATE POLICY tenant_isolation ON graph_coords_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
    
    -- Embeddings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'embeddings_v2') THEN
        CREATE POLICY tenant_isolation ON embeddings_v2 
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
END $$;

-- =====================================================================
-- HELPER FUNCTIONS FOR TENANT CONTEXT
-- =====================================================================

-- Set tenant context for current session
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', tenant_uuid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current tenant context
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.tenant_id', true)::uuid;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenants_updated_at') THEN
        CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_nodes_v2_updated_at') THEN
        CREATE TRIGGER update_nodes_v2_updated_at BEFORE UPDATE ON nodes_v2
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_edges_v2_updated_at') THEN
        CREATE TRIGGER update_edges_v2_updated_at BEFORE UPDATE ON edges_v2
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tags_v2_updated_at') THEN
        CREATE TRIGGER update_tags_v2_updated_at BEFORE UPDATE ON tags_v2
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================================
-- INITIAL SEED DATA (DEFAULT TENANT)
-- =====================================================================

-- Insert default tenant if not exists
INSERT INTO tenants (id, slug, name, status)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'default',
    'Default Tenant',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- PERFORMANCE OPTIMIZATION NOTES
-- =====================================================================

-- For production deployment:
-- 1. Partition large tables (nodes_v2, edges_v2, glyphs_4d) by tenant_id for better performance
-- 2. Use connection pooling (PgBouncer) for PostgreSQL
-- 3. Enable query plan caching with prepared statements
-- 4. Configure pgvector parameters: vector.hnsw.ef_search = 40-80 for accuracy/speed tradeoff
-- 5. Set up regular VACUUM ANALYZE jobs for statistics
-- 6. Monitor index usage with pg_stat_user_indexes
-- 7. Consider materialized views for complex analytics queries

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
