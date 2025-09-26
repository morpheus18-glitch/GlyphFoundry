-- Create nodes table
CREATE TABLE IF NOT EXISTS node (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'offline',
    healthy BOOLEAN NOT NULL DEFAULT FALSE,
    cpu_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    labels JSONB,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settingentry (
    id SERIAL PRIMARY KEY,
    key VARCHAR(128) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create embedding records
CREATE TABLE IF NOT EXISTS embeddingrecord (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(128) UNIQUE NOT NULL,
    text_preview VARCHAR(512) NOT NULL,
    vector VECTOR(256) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
