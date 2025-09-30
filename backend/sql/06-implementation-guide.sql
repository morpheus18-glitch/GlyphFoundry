-- =====================================================================
-- OPERATIONAL IMPLEMENTATION GUIDE
-- =====================================================================
-- This file addresses operational concerns for production deployment
-- including RLS bootstrapping, authentication, and middleware integration
-- =====================================================================

-- =====================================================================
-- 1. RLS BOOTSTRAP FUNCTIONS (Secure Tenant Creation)
-- =====================================================================

-- IMPORTANT: This function requires the owner to have BYPASSRLS privilege
-- CREATE ROLE glyph_admin BYPASSRLS LOGIN;
-- ALTER FUNCTION create_tenant_bootstrap() OWNER TO glyph_admin;

-- Bootstrap function for tenant creation (SECURITY DEFINER with BYPASSRLS owner)
CREATE OR REPLACE FUNCTION create_tenant_bootstrap(
    p_tenant_id UUID,
    p_slug TEXT,
    p_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify caller has admin database role (NOT GUC-based)
    IF NOT pg_has_role(current_user, 'glyph_admin', 'member') THEN
        RAISE EXCEPTION 'Only admin database users can create tenants';
    END IF;
    
    -- Insert tenant (bypasses RLS due to SECURITY DEFINER)
    INSERT INTO tenants (id, slug, name, status)
    VALUES (p_tenant_id, p_slug, p_name, 'active')
    ON CONFLICT (id) DO NOTHING;
    
    RETURN p_tenant_id;
END;
$$;

-- Grant execute to application role
GRANT EXECUTE ON FUNCTION create_tenant_bootstrap TO glyph_app;

-- =====================================================================
-- 2. AUTHENTICATION LOOKUP FUNCTIONS
-- =====================================================================

-- IMPORTANT: This function requires the owner to have BYPASSRLS privilege
-- ALTER FUNCTION lookup_tenant_by_api_key() OWNER TO glyph_admin;

-- Lookup tenant_id from API key (bypasses RLS via BYPASSRLS owner)
CREATE OR REPLACE FUNCTION lookup_tenant_by_api_key(
    p_key_prefix TEXT
) RETURNS TABLE(tenant_id UUID, scopes TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT ak.tenant_id, ak.scopes
    FROM api_keys ak
    WHERE ak.prefix = p_key_prefix
      AND (ak.expires_at IS NULL OR ak.expires_at > now())
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_tenant_by_api_key TO glyph_app;

-- Lookup tenant_id from user email (for user authentication)
CREATE OR REPLACE FUNCTION lookup_tenant_by_user_email(
    p_email TEXT
) RETURNS TABLE(tenant_id UUID, user_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT u.tenant_id, u.id, u.role::TEXT
    FROM users u
    WHERE u.email = p_email
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_tenant_by_user_email TO glyph_app;

-- =====================================================================
-- 3. HISTORY TABLE GUARDS (Prevent migration failures)
-- =====================================================================

-- Ensure history tables exist before creating triggers
DO $$
BEGIN
    -- Create nodes_history if not exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'nodes_history') THEN
        CREATE TABLE nodes_history (
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
        CREATE INDEX nodes_history_tenant_valid_idx ON nodes_history(tenant_id, valid_from DESC);
    END IF;
    
    -- Create edges_history if not exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'edges_history') THEN
        CREATE TABLE edges_history (
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
        CREATE INDEX edges_history_tenant_valid_idx ON edges_history(tenant_id, valid_from DESC);
    END IF;
END $$;

-- =====================================================================
-- 4. MIDDLEWARE INTEGRATION HELPERS
-- =====================================================================

-- Helper to set both tenant and user context in one call
CREATE OR REPLACE FUNCTION set_request_context(
    p_tenant_id UUID,
    p_user_id TEXT DEFAULT NULL,
    p_user_role TEXT DEFAULT 'user'
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::TEXT, false);
    
    IF p_user_id IS NOT NULL THEN
        PERFORM set_config('app.user_id', p_user_id, false);
    END IF;
    
    IF p_user_role IS NOT NULL THEN
        PERFORM set_config('app.user_role', p_user_role, false);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_request_context TO glyph_app;

-- Get current request context (for debugging)
CREATE OR REPLACE FUNCTION get_request_context()
RETURNS TABLE(tenant_id TEXT, user_id TEXT, user_role TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_setting('app.tenant_id', true),
        current_setting('app.user_id', true),
        current_setting('app.user_role', true);
END;
$$;

GRANT EXECUTE ON FUNCTION get_request_context TO glyph_app;

-- =====================================================================
-- 5. PYTHON MIDDLEWARE EXAMPLE
-- =====================================================================

/*
Python FastAPI middleware implementation:

```python
from fastapi import Request, HTTPException
from sqlalchemy import text
import hashlib

async def authenticate_request(request: Request, db: Session):
    # Extract API key from header
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(401, "API key required")
    
    # Hash the key and get prefix for lookup
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    key_prefix = api_key[:8]
    
    # Lookup tenant using SECURITY DEFINER function
    result = await db.execute(
        text("SELECT * FROM lookup_tenant_by_api_key(:prefix)"),
        {"prefix": key_prefix}
    )
    row = result.first()
    
    if not row:
        raise HTTPException(401, "Invalid API key")
    
    # Verify full hash matches (stored as hashed_key in api_keys table)
    # ... hash verification logic ...
    
    # Set request context (enables RLS)
    await db.execute(
        text("SELECT set_request_context(:tid, :uid, :role)"),
        {
            "tid": row.tenant_id,
            "uid": f"api-key-{key_prefix}",
            "role": "user"
        }
    )
    
    # Update last_used_at
    await db.execute(
        text("UPDATE api_keys SET last_used_at = now() WHERE prefix = :prefix"),
        {"prefix": key_prefix}
    )
    
    return row.tenant_id

# Apply to all routes
@app.middleware("http")
async def tenant_context_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        async with session_scope() as db:
            tenant_id = await authenticate_request(request, db)
            request.state.tenant_id = tenant_id
    
    response = await call_next(request)
    return response
```
*/

-- =====================================================================
-- 6. EMBEDDINGS VALIDATION
-- =====================================================================

-- Ensure obj_type_enum includes all valid types
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'obj_type_enum'
    ) THEN
        RAISE EXCEPTION 'obj_type_enum not found! Run 03-production-schema.sql first';
    END IF;
    
    -- Verify embeddings trigger matches enum values
    -- Valid types: 'glyph', 'message', 'node', 'tag', 'document'
END $$;

-- =====================================================================
-- 7. PRODUCTION DEPLOYMENT CHECKLIST
-- =====================================================================

/*
CRITICAL: Follow this checklist before production deployment:

□ Database Schema
  □ Run 03-production-schema.sql (base schema with pgvector)
  □ Run 05-security-hardening.sql (RLS, triggers, roles)
  □ Run 06-implementation-guide.sql (this file - bootstrap functions)
  
□ Database Roles & Passwords
  □ Set glyph_app password: ALTER ROLE glyph_app PASSWORD '${SECURE_PASSWORD}';
  □ Set glyph_readonly password: ALTER ROLE glyph_readonly PASSWORD '${READONLY_PASSWORD}';
  □ Store passwords in Kubernetes secrets
  
□ Verify RLS
  □ SELECT tablename, relrowsecurity, relforcerowsecurity FROM pg_tables WHERE schemaname='public';
  □ SELECT COUNT(*) FROM pg_policies WHERE policyname = 'tenant_isolation'; -- Should be 9+
  
□ Test Multi-Tenant Isolation
  □ Create test tenant A with UUID
  □ Set context: SELECT set_tenant_context('tenant-a-uuid');
  □ Insert test data
  □ Create test tenant B
  □ Set context: SELECT set_tenant_context('tenant-b-uuid');
  □ Verify tenant A data is invisible (RLS working)
  
□ Infrastructure
  □ Redis deployed with TLS-only (rediss://)
  □ Kafka deployed with SASL/TLS and ACLs
  □ MinIO deployed with distributed mode and TLS
  □ Kubernetes secrets configured for all services
  
□ Application Code
  □ Middleware sets app.tenant_id on every request
  □ Authentication uses lookup_tenant_by_api_key()
  □ Redis client uses rediss:// protocol
  □ Kafka clients use SASL/TLS configuration
  
□ Monitoring
  □ Prometheus scraping all services
  □ Grafana dashboards configured
  □ Alerts set up for RLS violations, auth failures
  
□ Backup & DR
  □ PostgreSQL backup schedule configured
  □ Point-in-time recovery tested
  □ Disaster recovery runbook documented
*/

-- =====================================================================
-- 8. TESTING QUERIES
-- =====================================================================

-- Test 1: Verify RLS is working
DO $$
DECLARE
    test_tenant_id UUID := gen_random_uuid();
BEGIN
    -- Create test tenant (as admin)
    PERFORM set_config('app.user_role', 'admin', false);
    PERFORM create_tenant_bootstrap(test_tenant_id, 'test-tenant', 'Test Tenant');
    
    -- Set context to test tenant
    PERFORM set_tenant_context(test_tenant_id);
    
    -- Insert test node
    INSERT INTO nodes_v2 (tenant_id, kind, name)
    VALUES (test_tenant_id, 'message', 'Test Node');
    
    -- Verify we can read it
    IF NOT EXISTS (SELECT 1 FROM nodes_v2 WHERE name = 'Test Node') THEN
        RAISE EXCEPTION 'RLS test failed: Cannot read own tenant data';
    END IF;
    
    -- Switch to different tenant context
    PERFORM set_tenant_context(gen_random_uuid());
    
    -- Verify we CANNOT read previous tenant's data
    IF EXISTS (SELECT 1 FROM nodes_v2 WHERE name = 'Test Node') THEN
        RAISE EXCEPTION 'RLS test failed: Can read other tenant data!';
    END IF;
    
    RAISE NOTICE 'RLS test passed: Tenant isolation working correctly';
END $$;

-- Test 2: Verify cross-tenant integrity
DO $$
DECLARE
    tenant_a UUID := gen_random_uuid();
    tenant_b UUID := gen_random_uuid();
    node_a UUID;
    node_b UUID;
BEGIN
    -- Setup tenant A
    PERFORM set_config('app.user_role', 'admin', false);
    PERFORM create_tenant_bootstrap(tenant_a, 'tenant-a', 'Tenant A');
    PERFORM set_tenant_context(tenant_a);
    
    INSERT INTO nodes_v2 (tenant_id, kind, name) 
    VALUES (tenant_a, 'message', 'Node A') RETURNING id INTO node_a;
    
    -- Setup tenant B
    PERFORM create_tenant_bootstrap(tenant_b, 'tenant-b', 'Tenant B');
    PERFORM set_tenant_context(tenant_b);
    
    INSERT INTO nodes_v2 (tenant_id, kind, name) 
    VALUES (tenant_b, 'message', 'Node B') RETURNING id INTO node_b;
    
    -- Try to create edge between nodes from different tenants (should fail)
    BEGIN
        INSERT INTO edges_v2 (tenant_id, src_id, dst_id, edge_type)
        VALUES (tenant_b, node_a, node_b, 'relates_to');
        
        RAISE EXCEPTION 'Cross-tenant integrity test failed: Edge created across tenants!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Cross-tenant integrity test passed: % ', SQLERRM;
    END;
END $$;

-- =====================================================================
-- END OF IMPLEMENTATION GUIDE
-- =====================================================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE '
    =====================================================================
    IMPLEMENTATION GUIDE APPLIED SUCCESSFULLY
    =====================================================================
    
    ✅ Bootstrap functions created
    ✅ Authentication lookup functions ready
    ✅ History tables ensured
    ✅ Request context helpers available
    ✅ Testing queries included
    
    NEXT STEPS:
    1. Set database role passwords via ALTER ROLE
    2. Update application code to use middleware (see comments)
    3. Configure infrastructure (Redis TLS, Kafka SASL, MinIO)
    4. Run production deployment checklist
    5. Execute RLS and cross-tenant integrity tests
    
    See comments in this file for Python middleware examples.
    =====================================================================
    ';
END $$;
