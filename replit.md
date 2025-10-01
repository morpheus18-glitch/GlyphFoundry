# Glyph Foundry

## Overview
Glyph Foundry is a comprehensive knowledge graph visualization and analytics platform designed for exploring complex data relationships. It integrates real-time data processing, cinematic 3D visualization, and distributed computing. The platform processes textual content using NLP to generate embeddings and knowledge relationships, which are then visualized through an immersive WebGL-powered frontend. Its core purpose is to provide a powerful tool for analyzing and interacting with complex, interconnected information.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
The backend is built with FastAPI and async SQLAlchemy, utilizing PostgreSQL with pgvector for efficient graph data storage and vector similarity search. It features RESTful APIs, connection pooling, and Alembic for database migrations.

### Data Processing Pipeline
A Kafka-based event streaming system ingests messages for real-time text processing. NLP pipelines, including sentence transformers, generate embeddings and automatically detect and create relationships for the knowledge graph. A force-directed layout engine uses PCA for node positioning, complemented by a rule-based and ML-driven tagging system.

### Worker Architecture
A distributed worker system, coordinated via Redis, processes data in parallel. Key workers include:
- **NLP Extract Worker**: Generates text embeddings.
- **Linker Worker**: Creates graph edges based on similarity.
- **Layout Worker**: Computes 3D node positions.
- **Tag Workers**: Manages tag proposals and suggestions.
An orchestrator monitors worker health and publishes fleet snapshots.

### Frontend Architecture
The frontend is a React + TypeScript application with Vite and Tailwind CSS. It features a unified cinematic knowledge network combining Three.js-based 3D graph visualization with HDR rendering, bloom effects, particles, and glassmorphism UI. The interface uses a deep black background with rust/orange HDR gradient accents, creating a "Google Earth meets ChatGPT" experience for exploring knowledge. Web Workers power responsive force-directed layout calculations in 3D space. Interactive node detail panels with glassmorphism allow users to click nodes and explore connections. The experience is unified into one primary view rather than separate graph and cinematic sections.

### Graph Data Model
The system models `Nodes` (messages, glyphs, entities with embeddings), `Edges` (weighted relationships with confidence scores), `Tags` (hierarchical labeling), and `Coordinates` (3D positioning). It also supports a 4D Glyph system for time-dimensional visualization.

### Native Integration
High-performance components include Rust kernels for TAA denoising via Python bindings and optional WebAssembly modules for client-side acceleration.

### User Personalization & Account Management
The platform supports user-level personalization with JWT-based authentication and role-based access control. It includes features for managing user preferences, custom AI instructions, learned behavioral profiles, and personalized dashboards, all secured with RLS policies.

### Multi-Modal File Ingestion System
A robust system allows ingestion of various file types (images, documents, videos, audio, text, CSV, JSON) from mobile devices, with automatic text extraction and MinIO/S3 integration for storage.

### Monitoring & Observability
A Go-based collector gathers high-performance system metrics, which are then converted into 4D glyphs for visualization. An Admin Dashboard provides a real-time monitoring interface. The MCP (Model Context Protocol) Server integrates ChatGPT and Claude conversations into the knowledge graph for analysis.

## External Dependencies

### Databases
- **PostgreSQL**: Primary data store, extended with `pgvector` for vector operations.
- **Redis**: Used for worker coordination, caching, and job queues.

### Message Queues
- **Apache Kafka**: Core event streaming platform for real-time data processing.
- **Redpanda**: Kafka-compatible broker for development environments.

### Object Storage
- **MinIO**: S3-compatible storage for data exports and file uploads.

### Machine Learning
- **Sentence Transformers**: For generating text embeddings.
- **scikit-learn**: Used for dimensionality reduction and clustering algorithms.
- **NumPy/Pandas**: For numerical computing and data manipulation.

### Monitoring & Observability
- **Prometheus**: For metrics collection and worker health monitoring.
- **APScheduler**: For cron-like job scheduling.

### Development Tools
- **Alembic**: Database migration management.
- **Gunicorn/Uvicorn**: ASGI servers for deployment.
- **Maturin**: Facilitates Rust-Python binding compilation.

### Frontend Libraries
- **Three.js**: For 3D graphics and WebGL rendering.
- **React Three Fiber**: Integrates Three.js with React.
- **D3-Force**: Used for force-directed graph layout algorithms.
- **PostProcessing**: For cinematic effects and shader pipeline management.