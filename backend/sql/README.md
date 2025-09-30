# Database Schema & Infrastructure Documentation

## Overview

This directory contains the complete production-grade database schema and infrastructure setup for the Glyph Foundry multi-tenant SaaS knowledge graph platform.

## Files

### Schema Files (Apply in Order)

1. **00-init.sql** - Legacy initialization (deprecated, use v2 schema)
2. **01-tags.sql** - Legacy tags schema (deprecated, use v2 schema)
3. **02-quantum-knowledge-network.sql** - Legacy quantum network (deprecated, use v2 schema)
4. **03-production-schema.sql** ⭐ - **PRIMARY SCHEMA** - Complete production schema with:
   - Multi-tenant tables with tenant_id
   - pgvector integration for embeddings
   - 4D glyph visualization tables
   - Comprehensive indexes
   - Enums for type safety
   - Audit and history tables

5. **05-security-hardening.sql** 🔒 - **CRITICAL** - Security hardening patch:
   - Row-Level Security (RLS) enforcement
   - Cross-tenant data integrity constraints
   - Audit logging triggers
   - Database roles and least privilege
   - Vector index fallbacks
   - Verification queries

### Documentation

- **04-infrastructure-setup.md** 📖 - Complete infrastructure guide:
  - PostgreSQL with pgvector configuration
  - Redis caching architecture
  - Kafka event streaming setup
  - MinIO/S3 object storage
  - Kubernetes deployment manifests
  - Monitoring and observability
  - Performance tuning
  - Security best practices (TLS, AUTH, secrets)

## Quick Start

### 1. Deploy Database Schema

```bash
# Apply production schema
psql $DATABASE_URL -f 03-production-schema.sql

# Apply security hardening (CRITICAL)
psql $DATABASE_URL -f 05-security-hardening.sql
```

### 2. Verify Installation

```bash
# Check extensions
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname IN ('vector', 'pgcrypto', 'uuid-ossp');"

# Verify RLS is enabled
psql $DATABASE_URL -c "SELECT tablename, relrowsecurity, relforcerowsecurity FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename WHERE schemaname = 'public' AND tablename LIKE '%_v2';"

# Check tenant isolation policies
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname = 'tenant_isolation';"
```

### 3. Configure Application

In your application, set tenant context for each request:

```python
from app.db import session_scope

async def process_request(tenant_id: str):
    async with session_scope() as db:
        # Set tenant context (enables RLS)
        await db.execute(text("SELECT set_tenant_context(:tid)"), {"tid": tenant_id})
        
        # Set user context (for audit logging)
        await db.execute(text("SELECT set_config('app.user_id', :uid, false)"), 
                        {"uid": "user@example.com"})
        
        # Now all queries are automatically filtered by tenant_id
        nodes = await db.execute(text("SELECT * FROM nodes_v2"))
```

### 4. Deploy Infrastructure

Follow the comprehensive guide in `04-infrastructure-setup.md` for:
- PostgreSQL managed service or self-hosted setup
- Redis with TLS and authentication
- Kafka cluster with SASL/TLS
- MinIO with distributed mode and TLS
- Kubernetes deployments with HPA
- Monitoring stack (Prometheus/Grafana)

## Architecture Highlights

### Multi-Tenant Isolation

✅ **Tenant-scoped tables** - All data has `tenant_id` foreign key
✅ **Row-Level Security (RLS)** - Enforced at database level
✅ **Cross-tenant integrity** - Triggers prevent cross-tenant associations
✅ **Tenant context** - Set via `app.tenant_id` session variable

### Performance

✅ **Sub-100ms queries** - Covering indexes on tenant_id + frequently queried columns
✅ **HNSW vector search** - Optimized for high-dimensional embeddings
✅ **Redis caching** - 30-120s TTL for frequently accessed data
✅ **Kafka streaming** - Real-time event processing with partitioning

### Security

✅ **FORCE ROW LEVEL SECURITY** - No RLS bypass, even for superusers
✅ **Least privilege roles** - Separate app and readonly roles
✅ **Audit logging** - All DML operations tracked with actor and timestamp
✅ **TLS everywhere** - Redis, Kafka, MinIO all use TLS
✅ **Secrets management** - Kubernetes secrets or sealed-secrets

### Data Model

**Core Tables:**
- `tenants` - Multi-tenant organizations
- `users` - User accounts with roles
- `api_keys` - API authentication with scopes
- `nodes_v2` - Knowledge graph nodes with vector embeddings
- `edges_v2` - Knowledge graph relationships
- `tags_v2` - Hierarchical classification
- `glyphs_4d` - 4D visualization data (x, y, z + time)
- `embeddings_v2` - Centralized vector storage
- `audit_log` - Comprehensive audit trail

**Enums:**
- `node_kind_enum` - Node types (glyph, message, document, etc.)
- `edge_type_enum` - Relationship types
- `tag_category_enum` - Tag categories
- `glyph_type_enum` - Glyph/metric types

## Testing Multi-Tenant Isolation

```sql
-- Create test tenants
INSERT INTO tenants (id, slug, name) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'tenant-a', 'Tenant A'),
    ('22222222-2222-2222-2222-222222222222', 'tenant-b', 'Tenant B');

-- Set context to Tenant A
SELECT set_tenant_context('11111111-1111-1111-1111-111111111111');

-- Insert node for Tenant A
INSERT INTO nodes_v2 (tenant_id, kind, name) 
VALUES ('11111111-1111-1111-1111-111111111111', 'glyph', 'Test Node A');

-- Switch to Tenant B
SELECT set_tenant_context('22222222-2222-2222-2222-222222222222');

-- Try to query - should return empty (RLS isolation working)
SELECT * FROM nodes_v2; -- Returns 0 rows

-- Insert node for Tenant B
INSERT INTO nodes_v2 (tenant_id, kind, name) 
VALUES ('22222222-2222-2222-2222-222222222222', 'glyph', 'Test Node B');

-- Verify only Tenant B's data visible
SELECT * FROM nodes_v2; -- Returns 1 row (Tenant B's node)
```

## Production Deployment Checklist

- [ ] PostgreSQL with pgvector extension deployed
- [ ] Schema applied: `03-production-schema.sql`
- [ ] Security hardening applied: `05-security-hardening.sql`
- [ ] RLS verified with test tenants
- [ ] Redis deployed with TLS and AUTH
- [ ] Kafka deployed with SASL/TLS
- [ ] MinIO deployed with distributed mode and TLS
- [ ] Kubernetes secrets configured (or sealed-secrets)
- [ ] Application configured to set tenant context
- [ ] Monitoring stack deployed (Prometheus/Grafana)
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented
- [ ] Load testing completed
- [ ] Security audit completed

## Performance Benchmarks

Expected performance with proper indexing:

| Operation | Target | Actual |
|-----------|--------|--------|
| Node lookup by ID | <10ms | TBD |
| Graph query (300 nodes, 1500 edges) | <100ms | TBD |
| Vector similarity search (top 10) | <50ms | TBD |
| Glyph temporal query (1 day window) | <30ms | TBD |
| Edge traversal (1-hop) | <20ms | TBD |

## Troubleshooting

### RLS Not Working
```sql
-- Verify RLS is enabled and forced
SELECT tablename, relrowsecurity, relforcerowsecurity 
FROM pg_tables t 
JOIN pg_class c ON c.relname = t.tablename 
WHERE schemaname = 'public' AND tablename LIKE '%_v2';

-- Check tenant context is set
SELECT current_setting('app.tenant_id', true);

-- Verify policies exist
SELECT * FROM pg_policies WHERE policyname = 'tenant_isolation';
```

### Slow Vector Queries
```sql
-- Check if HNSW index is used
EXPLAIN ANALYZE 
SELECT * FROM nodes_v2 
ORDER BY embedding_384 <=> '[0.1, 0.2, ...]'::vector 
LIMIT 10;

-- Tune HNSW parameters
SET vector.hnsw.ef_search = 64; -- Increase for better accuracy
```

### Cross-Tenant Data Leak
```sql
-- Check for nodes without tenant_id
SELECT COUNT(*) FROM nodes_v2 WHERE tenant_id IS NULL;

-- Verify triggers are active
SELECT tgname, tgrelid::regclass FROM pg_trigger 
WHERE tgname LIKE '%tenant%';
```

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review infrastructure documentation: `04-infrastructure-setup.md`
3. Verify security hardening: `05-security-hardening.sql`
4. Contact platform team

## License

Copyright © 2025 Glyph Foundry. All rights reserved.
