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
- **Cinematic HDR Engine**: Real-time WebGL2 rendering with ACES Filmic tone mapping, procedural earth geometry, and GPU compute-style particle physics
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
- **4D Glyph System**: Advanced visualization with time as the 4th dimension for temporal analysis
- **Go Metrics Collector**: High-performance system metrics collection (CPU, memory, network, disk)
- **Admin Dashboard**: Real-time monitoring interface with React/TypeScript frontend
- **MCP Server**: Model Context Protocol integration for ChatGPT/Claude conversation ingestion
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

## Recent Additions (September 2025)

### User Personalization & Account Management System
- **Purpose**: Complete user-level personalization with role-based access control and learned behavioral profiles
- **Authentication**: Secure JWT-based authentication with proper RLS context isolation
- **Database Schema**: 5 new tables (user_preferences, custom_instructions, learned_profiles, user_interactions, search_history)
- **Features**:
  - User registration and profile management with secure password hashing
  - Theme, language, timezone, and UI preferences per user
  - Custom AI instructions with tuning parameters (temperature, max_tokens, top_p, frequency_penalty)
  - Semantic knowledge foundry that learns user interests, expertise, communication style
  - Behavioral pattern tracking (activity patterns, interaction frequency, common queries)
  - Personalized dashboard with stats, recent activity, popular searches
  - Search history with vector embeddings for personalized recommendations
- **API Endpoints**:
  - `POST /accounts/register` - User registration
  - `GET /accounts/profile` - Get user profile and preferences
  - `PUT /accounts/preferences` - Update UI/UX preferences
  - `POST /accounts/instructions` - Create custom AI instructions
  - `GET /accounts/instructions` - List user's custom instructions
  - `GET /accounts/learned-profile` - Get AI-learned user profile
  - `POST /accounts/interactions` - Log user interactions for learning
  - `GET /accounts/dashboard` - Personalized insights dashboard
- **Security**: Full user-level isolation via RLS policies, JWT authentication, sensitive data protection

### Multi-Modal File Ingestion System
- **Purpose**: Accept pictures, files, and natural language from mobile devices
- **Storage**: MinIO/S3 integration with presigned URLs and local fallback
- **File Types**: Images (JPG, PNG, GIF, WebP), Documents (PDF, DOCX), CSV, JSON, Text, Video, Audio
- **Text Extraction**: PyPDF2 for PDFs, structured parsing for CSV/JSON
- **Mobile Compatible**: Full multipart/form-data support for Apple/Android fetch API
- **API Endpoints**:
  - `POST /files/upload` - Upload any file type with automatic text extraction
  - `POST /files/ingest/text` - Direct text/JSON/CSV ingestion
  - `GET /files/list` - List files with pagination and filtering
  - `GET /files/{id}` - Get file details and download URLs
  - `DELETE /files/{id}` - Soft delete files
- **Knowledge Graph**: Automatic node creation from uploaded content
- **Security**: Tenant-scoped storage, RLS policies, presigned URL expiry (7 days)

## Recent Additions (September 2025)

### 4D Glyph Visualization System
- **Purpose**: Time-dimensional knowledge graph visualization for advanced observability
- **Backend**: Python with deterministic blake2b hash-based spatial positioning
- **Frontend**: TypeScript/React with instanced rendering for 10,000+ glyphs
- **Features**: Temporal navigation, LOD optimization, custom 4D shaders with fresnel effects
- **API**: 7 FastAPI endpoints for glyph generation, temporal slicing, WebGL buffers, and timeline aggregation

### High-Performance Metrics Collection
- **Go Collector**: 8.7MB binary with gopsutil for system metrics
- **Performance**: Collects 34 metrics every 2 seconds with batching and buffering
- **Protocol Handlers**: Automatically converts metrics to 4D glyphs (CPU, memory, network, disk)
- **Architecture**: 4 worker goroutines with graceful shutdown
- **Configuration**: Environment-based with GLYPH_API_URL and tenant isolation

### Admin Dashboard
- **Backend API**: 7 FastAPI endpoints for monitoring and configuration
- **Frontend**: React/TypeScript with real-time statistics
- **Features**: Collector status, glyph distribution, spatial clustering, temporal analytics
- **Metrics**: Total metrics collected, generation rate, active collectors, protocol status

### MCP Server (Model Context Protocol)
- **Purpose**: Ingest ChatGPT and Claude conversations into knowledge graph
- **Implementation**: TypeScript with @modelcontextprotocol/sdk
- **Transport**: stdio (JSON-RPC 2.0) for Claude Desktop integration
- **Tools**: 3 MCP tools (ingest_conversation, create_conversation_glyphs, analyze_conversation)
- **Features**: Automatic glyph generation, conversation analysis, multi-tenant support
- **Integration**: Direct API connection with tenant isolation via headers

### Cinematic HDR Rendering Engine (September 2025)
- **Earth Cinematic Scene**: WebGL2 native rendering with procedural planet geometry
- **HDR Pipeline**: RGB16F framebuffer with ACES Filmic tone mapping for cinematic visuals
- **Procedural Earth**: Fresnel atmospheric glow, ocean/land pattern generation, dynamic rotation
- **Compute Particles**: 5000 particles with real-time gravitational field simulation
- **Geometry Functions**: Sphere generation with customizable segments, matrix math operations
- **Scene Portfolio**: 5 cinematic scenes (Neural Constellation, Quantum Wavefield, Volumetric Spines, Particle Vortex, Earth Cinematic)
- **Real-time Display**: Always-on rendering loop with 60fps target and delta-time physics

### Data Flow Pipeline
```
System Metrics → Go Collector → Protocol Handlers → Glyph API → 4D Visualization
ChatGPT/Claude → MCP Server → Conversation Parser → Glyph API → Knowledge Graph
```

### UI/UX Transformation (September 30, 2025)
- **Design Philosophy**: Transformed from dark "high-tech computer nerd style" to modern "production enterprise grade" interface
- **Branding**: Changed from "Quantum Nexus" to "Knowledge Graph" with professional KG logo
- **Theme**: Light gradient background (slate-50 to blue-50) replacing dark technical styling
- **Navigation**: Clean, accessible buttons with modern hover states and transitions
- **Components**: White cards with shadows, professional typography, and user-friendly language
- **Status Indicators**: Visual feedback with colored icons and green status dots
- **Loading States**: Professional spinners and "Loading..." messaging
- **Admin Dashboard**: Clean metrics interface with gradient stat cards
- **Accessibility**: WCAG compliant color contrast and clear visual hierarchy

### Production Notes
- All systems tested and operational
- Metrics collector generating glyphs in real-time (34 metrics every 2 seconds)
- MCP server successfully ingests conversations
- Admin dashboard provides live monitoring
- Multi-tenant isolation implemented via headers
- Seed data: 8 knowledge nodes (Quantum Computing, Neural Networks, ML, Blockchain, Space Exploration, etc.)
- Frontend: Modern, light, user-friendly interface suitable for average users
- Future hardening: authentication, persistent storage, worker pool parallelism