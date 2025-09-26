# Quantum Nexus Architecture

The monorepo is organized into backend services, distributed workers, database artifacts, and shared packages.

## Backend
- Built with FastAPI and SQLAlchemy using asynchronous connection pools.
- Exposes APIs for health, overview, node management, configuration, and embeddings.
- Integrates with Kafka for messaging and Redis for worker coordination.
- Emits Prometheus metrics and supports quantum simulation features via the `quantum_registry` service.

## Workers
- Shared base class provides Redis-backed coordination, Prometheus metrics, and graceful shutdowns.
- Embeddings worker consumes tasks from Redis queues and simulates embedding generation.
- Orchestrator worker polls worker heartbeats and publishes fleet snapshots to Kafka.
- Stream bridge moves events between Kafka topics.
- Scheduler worker runs periodic jobs using APScheduler.

## Database
- SQLAlchemy models define tables for nodes, configuration settings, and embeddings.
- Async connection pool auto-creates tables on startup; migrations are provided via SQL scripts.

## Packages
- `packages/contracts` stores OpenAPI schema fragments for multi-language clients.
- `packages/proto` holds protocol buffer definitions for future data-plane integrations.

## Observability
- Prometheus metrics exported on `/metrics`.
- Worker heartbeats tracked in Redis.
- Kafka state topic receives orchestrator snapshots for monitoring dashboards.
