# Glyph Foundry Architecture Overview

This document summarizes the existing codebase so future changes respect the current production-ready depth across services, workers, and cinematic frontend experiences.

## Backend Service (`backend/app`)

### FastAPI entry point
- `main.py` configures structured logging, CORS, middleware, and error handling, then mounts the router tree from `routes/__init__.py`. It bootstraps optional schema validation, exposes `/graph3d/data`, `/tags/data`, `/graph3d/view`, worker trigger endpoints, and performance analytics via `/graph/stats`. Graph payloads clamp node/edge counts and apply fallback windows before returning payloads to the UI templates. 【F:backend/app/main.py†L1-L206】

### Routing layer
- `routes/api.py` and `routes/health.py` provide explicit API routers for producing glyph relationships and health telemetry. The main router is automatically registered by the FastAPI application. 【F:backend/app/routes/api.py†L1-L20】【F:backend/app/routes/health.py†L1-L12】

### Database integration
- `db.py` centralizes SQLAlchemy engine configuration with tuned pool sizing, retry-friendly session scopes, and dependency injection for request handlers. 【F:backend/app/db.py†L1-L28】
- `models.py` defines strongly-typed ORM models for glyphs, messages, embeddings (using `pgvector`), edges, and tags with constraints and indexes matching production workloads. 【F:backend/app/models.py†L1-L98】
- `sql/00-init.sql`, `sql/01-tags.sql`, and `sql/02-quantum-knowledge-network.sql` provide schema DDL for initializing and extending the graph database. 【F:backend/sql/00-init.sql†L2-L155】【F:backend/sql/01-tags.sql†L1-L16】【F:backend/sql/02-quantum-knowledge-network.sql†L1-L160】

### Data exports & analytics
- `exports.py` assembles graph responses and tag exports entirely in SQL, including fallbacks and JSON aggregation optimizations to keep hot-path queries inside the database. 【F:backend/app/exports.py†L1-L98】

### Messaging and background workers
- `kafka_bus.py` encapsulates Kafka producer/consumer lifecycle management with retry protection and runtime health checks. 【F:backend/app/kafka_bus.py†L1-L51】
- Worker launchers in `workers/*.py` wire long-running services (`nlp_extract`, `linker_worker`, `layout_worker`, `tag_suggester`, etc.) through a common supervisor loop. 【F:backend/app/workers/run_nlp_extract.py†L1-L12】
- Domain modules such as `curation_worker.py`, `layout_worker.py`, and `tag_protocol_handler.py` implement the actual processing pipelines invoked by the runners. 【F:backend/app/curation_worker.py†L1-L27】【F:backend/app/layout_worker.py†L1-L50】【F:backend/app/tag_protocol_handler.py†L1-L60】

### Native integration service
- `services/native.py` exposes production bindings around the Rust TAA denoising kernel (`qce_kernels_py`), performing strict buffer conversion before delegating to the compiled module. 【F:backend/app/services/native.py†L1-L28】

## Cinematic Frontend (`frontend/src`)

### Application shell
- `App.tsx` composes the knowledge network visualization, cinematic shader showcase, and tag analytics panels within the Tailwind-driven layout. 【F:frontend/src/App.tsx†L1-L149】

### WebGL cinematic engine
- `qce/QCEngine.ts` orchestrates HDR pipelines, cinematic cameras, transform-feedback particle systems, and scene registration for WebGL2 playback with dynamic resizing and frame scheduling. 【F:frontend/src/qce/QCEngine.ts†L1-L110】
- Engine submodules implement reusable rendering infrastructure:
  - `engine/core/HDRPipeline.ts` manages floating-point framebuffers and bloom resolve passes. 【F:frontend/src/qce/engine/core/HDRPipeline.ts†L1-L138】
  - `engine/core/Camera.ts` implements the cinematic orbital camera with inertial smoothing. 【F:frontend/src/qce/engine/core/Camera.ts†L1-L140】
  - `engine/particles/TFParticleSim.ts` performs transform feedback particle evolution. 【F:frontend/src/qce/engine/particles/TFParticleSim.ts†L1-L181】
  - `engine/pipeline/TAA.ts` binds to the native temporal anti-aliasing worker. 【F:frontend/src/qce/engine/pipeline/TAA.ts†L1-L103】
  - `engine/utils/wasm.ts` lazy-loads wasm kernels when available. 【F:frontend/src/qce/engine/utils/wasm.ts†L1-L56】

### Scene orchestration
- `qce/scenes/*` defines shader-driven storylines (`NeuralConstellation`, `QuantumWavefield`, `VolumetricSpines`, `ParticleVortex`) with lifecycle hooks consumed by the engine. 【F:frontend/src/qce/scenes/SceneManager.ts†L1-L39】

### Graph intelligence UI
- `components/NeuralKnowledgeNetwork.tsx` renders the live knowledge graph in Three.js, streaming position data from a web worker, applying cinematic post-processing, and handling user focus interactions. 【F:frontend/src/components/NeuralKnowledgeNetwork.tsx†L1-L200】
- `workers/force3d.worker.ts` runs the force-directed layout in a dedicated thread to keep the main UI responsive. 【F:frontend/src/workers/force3d.worker.ts†L1-L200】
- `components/TagsTable.tsx` and supporting CSS render production-grade analytics tables for tag confidence exploration. 【F:frontend/src/components/TagsTable.tsx†L1-L24】

### Cinematic showcase
- `components/CinematicScenes.tsx` boots the cinematic engine inside a responsive overlay with scene selection controls, failure reporting, and cinematic descriptions. 【F:frontend/src/components/CinematicScenes.tsx†L1-L94】

## Native bindings (`native/rust/qce_kernels`)
- Rust crates provide GPU-accelerated temporal anti-aliasing kernels compiled via `maturin` into the Python extension consumed by `services/native.py`. Build scripts and bindings live alongside the Rust sources. 【F:native/rust/qce_kernels/src/lib.rs†L1-L13】

## Orchestration & Operations
- Dockerfiles (`backend/Dockerfile`, `Dockerfile`, `docker-compose.yml`, and overrides) define production and local deployment topologies.
- `requirements.txt` (root and backend) lock Python dependencies for API and worker services.
- `edge/` and `edge-ports.override.yml` configure edge routing, SSL termination, and port overrides for the cinematic frontend and API.

---
This overview reflects the depth of the current Glyph Foundry stack so follow-up changes remain cohesive with the existing production-grade implementation.
