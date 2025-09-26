# Quantum Nexus API Documentation

## Health
- `GET /api/v1/healthz`: Returns health indicators for the database and message queue.
- `GET /api/v1/readiness`: Indicates startup readiness state.

## Overview
- `GET /api/v1/overview`: Summarizes node health distribution.
- `GET /api/v1/telemetry`: Snapshots Prometheus metrics exported by the service.

## Nodes
- `POST /api/v1/nodes`: Registers a node using API key authentication.
- `GET /api/v1/nodes`: Lists all registered nodes.
- `PATCH /api/v1/nodes/{id}`: Updates node state and telemetry metrics.
- `DELETE /api/v1/nodes/{id}`: Removes a node from the registry.

## Settings
- `GET /api/v1/settings`: Retrieves persisted configuration entries.
- `POST /api/v1/settings`: Creates a configuration entry.
- `PATCH /api/v1/settings/{key}`: Updates an existing entry.

## Embeddings
- `POST /api/v1/embeddings`: Generates deterministic embeddings for submitted texts.

## Metrics
- `GET /metrics`: Exposes Prometheus metrics.
