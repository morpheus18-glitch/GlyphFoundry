# Glyph Foundry

## Overview
Glyph Foundry is a knowledge graph visualization and analytics platform designed for exploring complex data relationships. It integrates real-time data processing, cinematic 3D visualization, and distributed computing. The platform processes textual content using NLP to generate embeddings and knowledge relationships, which are then visualized through an immersive WebGL-powered frontend. Its core purpose is to provide a powerful tool for analyzing and interacting with complex, interconnected information, enabling a "Google Earth meets ChatGPT" experience for exploring knowledge.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
The backend uses FastAPI with async SQLAlchemy, PostgreSQL with pgvector for graph data and vector search, and Alembic for migrations. It provides RESTful APIs and connection pooling.

### Data Processing Pipeline
A Kafka-based event streaming system ingests data for real-time text processing. NLP pipelines generate embeddings and detect relationships for the knowledge graph. A force-directed layout engine uses PCA for node positioning, complemented by a rule-based and ML-driven tagging system.

### Worker Architecture
A distributed worker system, coordinated via Redis, processes data in parallel. Key workers include NLP Extract, Linker, Layout, and Tag Workers. An orchestrator monitors worker health and publishes fleet snapshots.

### Frontend Architecture
The frontend is a React + TypeScript application with Vite and Tailwind CSS. It features dual rendering engines for knowledge graph visualization:

#### G6 5.0 WebGL Renderer
A high-performance, GPU-accelerated graph visualization engine optimized for large knowledge graphs (10k-100k nodes). Features include automatic GPU detection with Canvas2D fallback, force-directed layouts using a Rust WebAssembly physics engine, birth animations, real-time data polling, and click interactions. It includes an adaptive rendering system with 4 quality tiers (Ultra, High, Standard, Eco) and mobile touch controls. Viewport culling and lazy loading handle up to 1M nodes, rendering visible subsets.

#### Babylon.js 3-Tier Renderer System
This system offers game engine-quality rendering with automatic selection based on device capabilities:
1.  **WebGPU Babylon Renderer**: For high-end desktop GPUs, offering advanced effects like clustered Forward+ lighting, full PBR materials with HDR image-based lighting (environment intensity 1.2), SSAO/SSR, volumetric effects, and HDR bloom (weight 1.5, kernel 128). Ultra-bright massive nodes (18x scale multiplier, 8x emissive color with 3.5 intensity) using faceted icospheres, pulsing animations, and cinematic click-to-zoom. Edges removed for cleaner visuals. GlowLayer set to 3.5 intensity with kernel 128 for ultra-bright HDR neon aesthetics. Full 3D orbital camera controls with unrestricted beta rotation, allowUpsideDown enabled, and camera reset functionality (ESC key or background double-click animates to canonical orbit: radius 1200, alpha π/4, beta π/3, target origin).
2.  **WebGL Babylon Renderer**: A WebGL 2.0 fallback with high-quality effects, including standard forward lighting, full PBR materials (metallic 0.95, roughness 0.15, albedo 0.5x) with HDR environment textures (intensity 1.2), and matching ultra-bright HDR node visuals (18x scale, 8x emissive with 3.5 intensity, textured icospheres, glow 3.5/128, bloom 0.2/1.5/128/0.8, animations, click-to-zoom). Shares identical camera controls with unrestricted 3D orbital movement and camera reset functionality.
3.  **Three.js Fallback Renderer**: For legacy or mobile devices, providing WebGL 1.0 compatibility with basic lighting and post-processing bloom.
The system automatically detects GPU capabilities and assigns tiers, with consistent visual styling (pure black backgrounds, ultra-bright HDR neon nodes) across all tiers. Both Babylon renderers feature professional-grade memory management with complete event listener cleanup (all handlers stored in refs and properly nullified on unmount), full 3D orbital camera controls (angular sensitivity 500, no beta limits), and true game engine-quality PBR rendering with HDR environment maps.

#### Three.js Cinematic Renderer
A Hollywood-grade 3D renderer featuring ACES Tone Mapping, volumetric god rays, anamorphic bloom, depth of field, chromatic aberration, and vignette effects. It employs four adaptive rendering paths based on camera distance and sun availability, with Web Workers powering force-directed layout calculations.

#### Data Management Interface
A comprehensive three-tab interface for CRUD operations on the knowledge graph: "Browse Data" (nodes and files), "Create Node" (manual entry), and "Upload Files" (multi-modal support with automatic processing). It supports cross-view navigation between data management and network visualization, highlighting selected nodes with animations.

### Graph Data Model
The system models `Nodes` (messages, glyphs, entities), `Edges` (weighted relationships), `Tags` (hierarchical labeling), and `Coordinates` (3D positioning). It also supports a 4D Glyph system for time-dimensional visualization.

### User Personalization & Account Management
Features a user settings interface for profile management (name, email, profile image), general preferences (theme, custom AI instructions), and visualization settings (force strength, label visibility). Backend endpoints handle updates with validation and tenant-scoped data isolation. An interactive 6-step onboarding guides new users through key features.

### Multi-Modal File Ingestion System
Supports ingestion of various file types (images, documents, videos, audio, text, CSV, JSON) from mobile devices, with automatic text extraction and MinIO/S3 integration for storage.

### Monitoring & Observability
A Go-based collector gathers system metrics, converted into 4D glyphs for visualization. An Admin Dashboard provides real-time monitoring. The MCP (Model Context Protocol) Server integrates ChatGPT and Claude conversations into the knowledge graph.

## External Dependencies

### Databases
-   **PostgreSQL**: Primary data store with `pgvector` for vector operations.
-   **Redis**: For worker coordination, caching, and job queues.

### Message Queues
-   **Apache Kafka**: Core event streaming platform.
-   **Redpanda**: Kafka-compatible broker for development.

### Object Storage
-   **MinIO**: S3-compatible storage.

### Machine Learning
-   **Sentence Transformers**: For generating text embeddings.
-   **scikit-learn**: For dimensionality reduction and clustering.
-   **NumPy/Pandas**: For numerical computing and data manipulation.

### Monitoring & Observability
-   **Prometheus**: For metrics collection and worker health monitoring.
-   **APScheduler**: For cron-like job scheduling.

### Development Tools
-   **Alembic**: Database migration management.
-   **Gunicorn/Uvicorn**: ASGI servers.
-   **Maturin**: Facilitates Rust-Python binding compilation.

### Frontend Libraries
-   **Three.js**: For 3D graphics and WebGL rendering.
-   **React Three Fiber**: Integrates Three.js with React.
-   **D3-Force**: For force-directed graph layout algorithms.
-   **PostProcessing**: For cinematic effects and shader pipeline management.