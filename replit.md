# Glyph Foundry

## Overview

Glyph Foundry is a comprehensive knowledge graph visualization and analytics platform that combines real-time data processing, cinematic 3D visualization, and distributed computing capabilities. The system processes textual content through NLP pipelines, generates embeddings, creates knowledge relationships, and provides an immersive WebGL-powered frontend for exploring complex data relationships.

The platform consists of a FastAPI backend with PostgreSQL and vector search capabilities, distributed worker services connected via Kafka, and a React/Three.js frontend featuring cinematic rendering engines and interactive graph visualizations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: FastAPI with async SQLAlchemy for high-performance database operations
- **Database**: PostgreSQL with pgvector extension for vector similarity search and graph data storage
- **API Design**: RESTful endpoints organized into modular routers (health, nodes, embeddings, settings)
- **Session Management**: Connection pooling with configurable pool sizes and automatic retry logic
- **Migration System**: Alembic for database schema versioning with idempotent upgrade scripts

### Data Processing Pipeline
- **Message Ingestion**: Kafka-based event streaming for real-time text processing
- **NLP Processing**: Sentence transformers for embedding generation with caching and normalization
- **Knowledge Graph**: Automatic relationship detection and edge creation between content nodes
- **Layout Engine**: Force-directed graph positioning using PCA dimensionality reduction
- **Tagging System**: Rule-based and ML-driven tag suggestion with confidence scoring

### Worker Architecture
- **Base Worker Pattern**: Shared Redis-backed coordination with Prometheus metrics and graceful shutdowns
- **NLP Extract Worker**: Processes text through embedding models and publishes candidates
- **Linker Worker**: Creates graph edges based on vector similarity and content relationships
- **Layout Worker**: Computes 3D positions for graph nodes using sklearn algorithms
- **Tag Workers**: Handle tag proposals, decisions, and automated rule-based suggestions
- **Orchestrator**: Monitors worker health and publishes fleet snapshots to Kafka

### Frontend Architecture
- **React + TypeScript**: Component-based UI with Vite build system and Tailwind CSS
- **WebGL Engine**: Custom QCEngine with HDR pipelines, particle systems, and cinematic cameras
- **3D Visualization**: Three.js with React Three Fiber for knowledge graph rendering
- **Post-Processing**: Bloom effects, depth of field, and temporal anti-aliasing
- **Web Workers**: Dedicated threads for force-directed layout calculations to maintain UI responsiveness

### Graph Data Model
- **Nodes**: Represent messages, glyphs, and entities with metadata and vector embeddings
- **Edges**: Weighted relationships with confidence scores and temporal tracking
- **Tags**: Hierarchical labeling system with confidence-based assignment
- **Coordinates**: 3D positioning data for spatial graph layout

### Native Integration
- **Rust Kernels**: High-performance TAA (Temporal Anti-Aliasing) denoising via Python bindings
- **WebAssembly**: Optional WASM modules for client-side performance acceleration
- **Buffer Management**: Strict type conversion between Python lists and native arrays

## External Dependencies

### Databases
- **PostgreSQL**: Primary data store with pgvector extension for vector operations
- **Redis**: Worker coordination, caching, and job queues

### Message Queues
- **Apache Kafka**: Event streaming for real-time data processing pipelines
- **Redpanda**: Kafka-compatible broker for development environments

### Object Storage
- **MinIO**: S3-compatible storage for data exports and analytics snapshots

### Machine Learning
- **Sentence Transformers**: Text embedding generation with GPU acceleration support
- **scikit-learn**: Dimensionality reduction and clustering algorithms
- **NumPy/Pandas**: Numerical computing and data manipulation

### Monitoring & Observability
- **Prometheus**: Metrics collection and worker health monitoring
- **APScheduler**: Cron-like job scheduling for maintenance tasks

### Development Tools
- **Alembic**: Database migration management
- **Gunicorn/Uvicorn**: ASGI server deployment with multi-worker support
- **Maturin**: Rust-Python binding compilation for native extensions

### Frontend Dependencies
- **Three.js**: 3D graphics and WebGL rendering
- **React Three Fiber**: React integration for Three.js scenes
- **D3-Force**: Force simulation algorithms for graph layout
- **PostProcessing**: Cinematic effects and shader pipeline management