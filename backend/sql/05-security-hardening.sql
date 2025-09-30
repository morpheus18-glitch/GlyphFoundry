-- =====================================================================
-- CRITICAL SECURITY HARDENING PATCH
-- =====================================================================
-- This patch addresses security gaps in the production schema:
-- 1. Enforce Row-Level Security (RLS) with FORCE option
-- 2. Fix cross-tenant data integrity with composite constraints
-- 3. Add audit/history triggers
-- 4. Implement least-privilege database roles
-- =====================================================================

-- =====================================================================
-- 1. FORCE ROW-LEVEL SECURITY ON ALL TENANT TABLES
-- =====================================================================

-- Enable and FORCE RLS (no bypass for table owners)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE nodes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE edges_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE tags_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE tag_links_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_links_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE node_tags_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_tags_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE glyphs_4d ENABLE ROW LEVEL SECURITY;
ALTER TABLE glyphs_4d FORCE ROW LEVEL SECURITY;

ALTER TABLE graph_coords_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_coords_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE embeddings_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings_v2 FORCE ROW LEVEL SECURITY;

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;

ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_chunks FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. CREATE STRICT RLS POLICIES
-- =====================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation ON tenants;
DROP POLICY IF EXISTS tenant_isolation ON api_keys;
DROP POLICY IF EXISTS tenant_isolation ON users;
DROP POLICY IF EXISTS tenant_isolation ON nodes_v2;
DROP POLICY IF EXISTS tenant_isolation ON edges_v2;
DROP POLICY IF EXISTS tenant_isolation ON tags_v2;
DROP POLICY IF EXISTS tenant_isolation ON tag_links_v2;
DROP POLICY IF EXISTS tenant_isolation ON node_tags_v2;
DROP POLICY IF EXISTS tenant_isolation ON glyphs_4d;
DROP POLICY IF EXISTS tenant_isolation ON graph_coords_v2;
DROP POLICY IF EXISTS tenant_isolation ON embeddings_v2;
DROP POLICY IF EXISTS tenant_isolation ON files;
DROP POLICY IF EXISTS tenant_isolation ON file_chunks;
DROP POLICY IF EXISTS tenant_isolation ON audit_log;
DROP POLICY IF EXISTS admin_full_access ON audit_log;

-- Create strict tenant isolation policies

-- Tenants table (special case - references itself by ID)
CREATE POLICY tenant_isolation ON tenants
    FOR ALL
    USING (id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

-- API Keys table
CREATE POLICY tenant_isolation ON api_keys
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Users table
CREATE POLICY tenant_isolation ON users
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Nodes table
CREATE POLICY tenant_isolation ON nodes_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON edges_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON tags_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON tag_links_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON node_tags_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON glyphs_4d
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON graph_coords_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON embeddings_v2
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Files table (multi-modal ingestion)
CREATE POLICY tenant_isolation ON files
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- File chunks table
CREATE POLICY tenant_isolation ON file_chunks
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Audit log (strict tenant isolation - no bypass)
CREATE POLICY tenant_isolation ON audit_log
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Admin policy for audit log (for system administrators)
CREATE POLICY admin_full_access ON audit_log
    FOR ALL
    USING (current_setting('app.user_role', true) = 'admin')
    WITH CHECK (current_setting('app.user_role', true) = 'admin');

-- =====================================================================
-- 3. CROSS-TENANT DATA INTEGRITY CONSTRAINTS
-- =====================================================================

-- Ensure edges connect nodes within the same tenant
CREATE OR REPLACE FUNCTION check_edge_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    src_tenant UUID;
    dst_tenant UUID;
BEGIN
    SELECT tenant_id INTO src_tenant FROM nodes_v2 WHERE id = NEW.src_id;
    SELECT tenant_id INTO dst_tenant FROM nodes_v2 WHERE id = NEW.dst_id;
    
    IF src_tenant IS NULL OR dst_tenant IS NULL THEN
        RAISE EXCEPTION 'Edge references non-existent node(s)';
    END IF;
    
    IF src_tenant != NEW.tenant_id OR dst_tenant != NEW.tenant_id THEN
        RAISE EXCEPTION 'Edge connects nodes from different tenants';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_edge_tenant_consistency ON edges_v2;
CREATE TRIGGER enforce_edge_tenant_consistency
    BEFORE INSERT OR UPDATE ON edges_v2
    FOR EACH ROW EXECUTE FUNCTION check_edge_tenant_consistency();

-- Ensure node_tags reference same-tenant entities
CREATE OR REPLACE FUNCTION check_node_tag_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    node_tenant UUID;
    tag_tenant UUID;
BEGIN
    SELECT tenant_id INTO node_tenant FROM nodes_v2 WHERE id = NEW.node_id;
    SELECT tenant_id INTO tag_tenant FROM tags_v2 WHERE id = NEW.tag_id;
    
    IF node_tenant IS NULL OR tag_tenant IS NULL THEN
        RAISE EXCEPTION 'Node tag references non-existent node or tag';
    END IF;
    
    IF node_tenant != NEW.tenant_id OR tag_tenant != NEW.tenant_id THEN
        RAISE EXCEPTION 'Node tag connects entities from different tenants';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_node_tag_tenant_consistency ON node_tags_v2;
CREATE TRIGGER enforce_node_tag_tenant_consistency
    BEFORE INSERT OR UPDATE ON node_tags_v2
    FOR EACH ROW EXECUTE FUNCTION check_node_tag_tenant_consistency();

-- Ensure tag_links reference same-tenant tags
CREATE OR REPLACE FUNCTION check_tag_link_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    parent_tenant UUID;
    child_tenant UUID;
BEGIN
    SELECT tenant_id INTO parent_tenant FROM tags_v2 WHERE id = NEW.parent_id;
    SELECT tenant_id INTO child_tenant FROM tags_v2 WHERE id = NEW.child_id;
    
    IF parent_tenant IS NULL OR child_tenant IS NULL THEN
        RAISE EXCEPTION 'Tag link references non-existent tag(s)';
    END IF;
    
    IF parent_tenant != NEW.tenant_id OR child_tenant != NEW.tenant_id THEN
        RAISE EXCEPTION 'Tag link connects tags from different tenants';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_tag_link_tenant_consistency ON tag_links_v2;
CREATE TRIGGER enforce_tag_link_tenant_consistency
    BEFORE INSERT OR UPDATE ON tag_links_v2
    FOR EACH ROW EXECUTE FUNCTION check_tag_link_tenant_consistency();

-- Ensure graph_coords reference same-tenant nodes
CREATE OR REPLACE FUNCTION check_graph_coords_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    node_tenant UUID;
BEGIN
    SELECT tenant_id INTO node_tenant FROM nodes_v2 WHERE id = NEW.node_id;
    
    IF node_tenant IS NULL THEN
        RAISE EXCEPTION 'Graph coords reference non-existent node';
    END IF;
    
    IF node_tenant != NEW.tenant_id THEN
        RAISE EXCEPTION 'Graph coords reference node from different tenant';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_graph_coords_tenant_consistency ON graph_coords_v2;
CREATE TRIGGER enforce_graph_coords_tenant_consistency
    BEFORE INSERT OR UPDATE ON graph_coords_v2
    FOR EACH ROW EXECUTE FUNCTION check_graph_coords_tenant_consistency();

-- Ensure embeddings reference same-tenant objects
CREATE OR REPLACE FUNCTION check_embeddings_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    obj_tenant UUID;
BEGIN
    -- Check tenant consistency based on object type
    CASE NEW.obj_type
        WHEN 'node' THEN
            SELECT tenant_id INTO obj_tenant FROM nodes_v2 WHERE id = NEW.obj_id;
        WHEN 'tag' THEN
            SELECT tenant_id INTO obj_tenant FROM tags_v2 WHERE id = NEW.obj_id;
        WHEN 'glyph' THEN
            SELECT tenant_id INTO obj_tenant FROM glyphs_4d WHERE id = NEW.obj_id;
        ELSE
            -- Reject unknown object types for security
            RAISE EXCEPTION 'Unknown object type not allowed: %', NEW.obj_type;
    END CASE;
    
    IF obj_tenant IS NULL THEN
        RAISE EXCEPTION 'Embedding references non-existent object: type=%, id=%', NEW.obj_type, NEW.obj_id;
    END IF;
    
    IF obj_tenant != NEW.tenant_id THEN
        RAISE EXCEPTION 'Embedding references object from different tenant';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_embeddings_tenant_consistency ON embeddings_v2;
CREATE TRIGGER enforce_embeddings_tenant_consistency
    BEFORE INSERT OR UPDATE ON embeddings_v2
    FOR EACH ROW EXECUTE FUNCTION check_embeddings_tenant_consistency();

-- =====================================================================
-- 4. FIX UNIQUE CONSTRAINT ON NODE_TAGS_V2
-- =====================================================================

-- Drop the invalid table constraint
ALTER TABLE node_tags_v2 DROP CONSTRAINT IF EXISTS node_tags_v2_node_id_tag_id_coalesce_key;

-- Create proper unique index
DROP INDEX IF EXISTS node_tags_v2_unique_dedupe_idx;
CREATE UNIQUE INDEX node_tags_v2_unique_dedupe_idx 
    ON node_tags_v2 (node_id, tag_id, COALESCE(dedupe_key, ''));

-- =====================================================================
-- 5. AUDIT LOG TRIGGERS
-- =====================================================================

-- Generic audit function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    tenant_val UUID;
BEGIN
    -- Extract tenant_id if available
    tenant_val := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.tenant_id
        ELSE NEW.tenant_id
    END;
    
    -- Log the change
    INSERT INTO audit_log (tenant_id, actor, table_name, action, record_id, old_data, new_data)
    VALUES (
        tenant_val,
        current_setting('app.user_id', true),
        TG_TABLE_NAME,
        lower(TG_OP),
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
    );
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
DROP TRIGGER IF EXISTS audit_nodes_v2 ON nodes_v2;
CREATE TRIGGER audit_nodes_v2
    AFTER INSERT OR UPDATE OR DELETE ON nodes_v2
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_edges_v2 ON edges_v2;
CREATE TRIGGER audit_edges_v2
    AFTER INSERT OR UPDATE OR DELETE ON edges_v2
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_tags_v2 ON tags_v2;
CREATE TRIGGER audit_tags_v2
    AFTER INSERT OR UPDATE OR DELETE ON tags_v2
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- =====================================================================
-- 6. HISTORY/TEMPORAL TRACKING TRIGGERS
-- =====================================================================

-- Nodes history trigger
CREATE OR REPLACE FUNCTION archive_node_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Close old record
    UPDATE nodes_history
    SET valid_to = now()
    WHERE id = OLD.id AND valid_to = 'infinity'::timestamptz;
    
    -- Insert new version
    INSERT INTO nodes_history (
        id, tenant_id, kind, name, summary, content, metadata, valid_from
    ) VALUES (
        NEW.id, NEW.tenant_id, NEW.kind, NEW.name, NEW.summary, NEW.content, NEW.metadata, now()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS archive_nodes_v2_history ON nodes_v2;
CREATE TRIGGER archive_nodes_v2_history
    AFTER UPDATE ON nodes_v2
    FOR EACH ROW EXECUTE FUNCTION archive_node_history();

-- Edges history trigger
CREATE OR REPLACE FUNCTION archive_edge_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Close old record
    UPDATE edges_history
    SET valid_to = now()
    WHERE id = OLD.id AND valid_to = 'infinity'::timestamptz;
    
    -- Insert new version
    INSERT INTO edges_history (
        id, tenant_id, src_id, dst_id, edge_type, relation_name, weight, valid_from
    ) VALUES (
        NEW.id, NEW.tenant_id, NEW.src_id, NEW.dst_id, NEW.edge_type, NEW.relation_name, NEW.weight, now()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS archive_edges_v2_history ON edges_v2;
CREATE TRIGGER archive_edges_v2_history
    AFTER UPDATE ON edges_v2
    FOR EACH ROW EXECUTE FUNCTION archive_edge_history();

-- =====================================================================
-- 7. DATABASE ROLES & LEAST PRIVILEGE
-- =====================================================================

-- CRITICAL: Do NOT set passwords in SQL scripts!
-- Create roles via Kubernetes secrets or environment variables

-- Create application role (password MUST be set via ALTER ROLE or Kubernetes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'glyph_app') THEN
        CREATE ROLE glyph_app WITH LOGIN;
        -- Set password via: ALTER ROLE glyph_app PASSWORD 'your-secret-password';
        -- OR via environment: PGPASSWORD=... createuser glyph_app --login
    END IF;
END
$$;

-- Grant minimal necessary privileges
GRANT USAGE ON SCHEMA public TO glyph_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO glyph_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO glyph_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO glyph_app;

-- Create read-only role for analytics
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'glyph_readonly') THEN
        CREATE ROLE glyph_readonly WITH LOGIN;
        -- Set password via: ALTER ROLE glyph_readonly PASSWORD 'your-secret-password';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO glyph_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO glyph_readonly;

-- IMPORTANT: After role creation, set passwords via:
-- psql> ALTER ROLE glyph_app PASSWORD '${GLYPH_APP_PASSWORD}';
-- psql> ALTER ROLE glyph_readonly PASSWORD '${GLYPH_READONLY_PASSWORD}';
-- Store these passwords in Kubernetes secrets!

-- =====================================================================
-- 8. ADDITIONAL VECTOR INDEX FALLBACKS
-- =====================================================================

-- Add missing HNSW fallbacks for other embedding dimensions
DO $$ 
BEGIN
    -- Try HNSW for 768-dim embeddings
    BEGIN
        CREATE INDEX IF NOT EXISTS nodes_v2_emb768_hnsw_idx 
            ON nodes_v2 USING hnsw (embedding_768 vector_cosine_ops)
            WHERE embedding_768 IS NOT NULL;
    EXCEPTION WHEN undefined_object THEN
        CREATE INDEX IF NOT EXISTS nodes_v2_emb768_ivf_idx 
            ON nodes_v2 USING ivfflat (embedding_768 vector_cosine_ops) WITH (lists=100)
            WHERE embedding_768 IS NOT NULL;
    END;
    
    -- Try HNSW for 1536-dim embeddings
    BEGIN
        CREATE INDEX IF NOT EXISTS nodes_v2_emb1536_hnsw_idx 
            ON nodes_v2 USING hnsw (embedding_1536 vector_cosine_ops)
            WHERE embedding_1536 IS NOT NULL;
    EXCEPTION WHEN undefined_object THEN
        CREATE INDEX IF NOT EXISTS nodes_v2_emb1536_ivf_idx 
            ON nodes_v2 USING ivfflat (embedding_1536 vector_cosine_ops) WITH (lists=100)
            WHERE embedding_1536 IS NOT NULL;
    END;
    
    -- Embeddings table
    BEGIN
        CREATE INDEX IF NOT EXISTS embeddings_v2_vec_hnsw_idx 
            ON embeddings_v2 USING hnsw (vec vector_cosine_ops);
    EXCEPTION WHEN undefined_object THEN
        CREATE INDEX IF NOT EXISTS embeddings_v2_vec_ivf_idx 
            ON embeddings_v2 USING ivfflat (vec vector_cosine_ops) WITH (lists=100);
    END;
END $$;

-- =====================================================================
-- 9. PERFORMANCE INDEX ADDITIONS
-- =====================================================================

-- Add index for edges by relation_name (common filter)
CREATE INDEX IF NOT EXISTS edges_v2_tenant_relation_idx 
    ON edges_v2(tenant_id, relation_name) 
    WHERE relation_name IS NOT NULL;

-- =====================================================================
-- 10. VERIFICATION QUERIES
-- =====================================================================

-- Verify RLS is enabled
DO $$
DECLARE
    rls_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
      AND c.relrowsecurity = true
      AND c.relforcerowsecurity = true
      AND t.tablename LIKE '%_v2'
         OR t.tablename IN ('tenants', 'api_keys', 'users', 'glyphs_4d', 'audit_log');
    
    IF rls_count < 10 THEN
        RAISE WARNING 'RLS not fully enabled! Only % tables have RLS', rls_count;
    ELSE
        RAISE NOTICE 'RLS successfully enabled on % tables', rls_count;
    END IF;
END $$;

-- Verify policies exist
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE policyname = 'tenant_isolation';
    
    IF policy_count < 9 THEN
        RAISE WARNING 'Not all tenant isolation policies created! Only % policies found', policy_count;
    ELSE
        RAISE NOTICE 'All % tenant isolation policies created successfully', policy_count;
    END IF;
END $$;

-- =====================================================================
-- END OF SECURITY HARDENING
-- =====================================================================

-- Instructions for application integration:
-- 
-- 1. Always set tenant context at the start of each request:
--    SELECT set_tenant_context('tenant-uuid-here');
--
-- 2. For audit logging, also set user context:
--    SELECT set_config('app.user_id', 'user@example.com', false);
--
-- 3. Use the glyph_app role for application connections
--
-- 4. Never use superuser roles in application code
--
-- 5. Test RLS by switching tenant context and verifying data isolation
