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
The frontend is a React + TypeScript application with Vite and Tailwind CSS. It features dual rendering engines for knowledge graph visualization:
- **G6 5.0 WebGL Renderer** (October 2025): High-performance graph visualization engine with GPU acceleration, optimized for large knowledge graphs (10k-100k nodes). Features automatic GPU detection with Canvas2D fallback, force-directed layouts, birth animations, and real-time data polling.
- **Three.js Cinematic Renderer**: Hollywood-grade 3D visualization with volumetric effects, bloom, god rays, and film-quality post-processing.

Users can toggle between renderers in the network view. The interface uses a deep black background with cyan/purple/magenta HDR aesthetics, creating a "Google Earth meets ChatGPT" experience for exploring knowledge.

#### G6 5.0 WebGL Renderer (October 2025 - Phase 1 Complete)
The platform features a high-performance G6 5.0 WebGL renderer as the primary knowledge graph visualization engine:

**Implementation Status:** ✅ Production Ready (Task 1 Complete)
- **GPU-Accelerated Rendering**: Automatic WebGL detection with Canvas2D fallback for maximum compatibility
- **Birth Animation System**: Organic node growth animations for both initial load and real-time polling updates
- **Force-Directed Layout**: Built-in physics-based positioning with configurable parameters
- **Real-Time Data Sync**: 3-second polling with automatic new node detection and animation
- **Click Interactions**: Node selection with detail panel integration
- **Performance Stats**: Live renderer type and node/edge count overlay

**Technical Architecture:**
- Factory pattern for renderer initialization: `() => new WebGLRenderer()` for WebGL, `() => new Renderer()` for Canvas2D
- API endpoint: `/graph3d/data` with configurable time windows and node/edge limits
- State management via `changeData()` for graph mutations (never `updateData()`)
- Birth timestamp tracking with `Map<string, number>` for animation scheduling
- Seen node IDs with `Set<string>` for new node detection during polling
- Responsive resize handling with separate width/height parameters

**Phase 1 Enhancements (October 2025 - Complete):**
- ✅ **Rust WebAssembly Physics Engine**: Barnes-Hut octree algorithm (O(n log n)) compiled to 109KB Wasm binary for force-directed layout calculations
- ✅ **Adaptive Rendering System**: 4-tier quality system (Ultra → High → Standard → Eco) with automatic FPS-based tier switching
  - Mobile starts at "Standard" tier (2k nodes, bloom only, ≥30 FPS target)
  - Desktop starts at "High" tier (5k nodes, MSAA 4x, bloom + shadows, ≥45 FPS target)
  - Automatic downgrade after 20 consecutive low-FPS frames (2s cooldown)
  - Automatic upgrade after stable performance (5s cooldown)
  - Real-time performance HUD with FPS, frame time, tier status, and manual override
- ✅ **Mobile Touch Controls**: Pinch-to-zoom, pan gestures, tap/long-press interactions with haptic feedback
- ✅ **Focused Node Detail View**: Cinematic node exploration with zoom-in animations
  - Click any node to zoom and focus with smooth camera animation (G6 v5 translateTo/zoomTo APIs)
  - Glassmorphism UI panels showing node content, smart tags, and related connections
  - Visual effects: focused node scales 2x with enhanced glow (40px shadow), other nodes dimmed to 15% opacity
  - Multiple exit methods: ESC key, X button, or click-outside backdrop
  - Mobile-responsive panels with proper touch target sizing
- **Viewport Culling** (Pending): For 1M+ node support with frustum culling and LOD

#### Three.js Cinematic Renderer (Legacy)
The visualization also includes a Hollywood-grade 3D renderer with volumetric effects:

**Core Rendering Stack:**
- **ACES Tone Mapping**: Film-industry standard color grading with 1.4 exposure
- **Volumetric God Rays**: Light scattering from pulsing VolumetricSun (60 samples, 0.97 density, screen blend)
- **Anamorphic Bloom**: Horizontal lens flares (2.8 intensity, 9 mipmap levels, large kernel)
- **Depth of Field**: Cinematic selective focus with 4.5x bokeh scale for close-ups
- **Chromatic Aberration**: Authentic lens color fringing effects
- **Vignette**: Film-style edge darkening (0.6 darkness, 0.3 offset)
- **8x MSAA**: High-quality anti-aliasing via multisampling

**Four Adaptive Rendering Paths:**
1. Close LOD with God Rays: Full suite (Bloom + GodRays + DOF + ChromaticAberration + Vignette + SMAA)
2. Far LOD with God Rays: Performance mode (Bloom + GodRays + ChromaticAberration + Vignette + SMAA, no DOF)
3. Close LOD Fallback: Traditional cinematic (Bloom + DOF + ChromaticAberration + Vignette + SMAA)
4. Far LOD Fallback: Minimal overhead (Bloom + ChromaticAberration + Vignette + SMAA)

The system automatically selects rendering paths based on camera distance and sun reference availability. Web Workers power responsive force-directed layout calculations in 3D space. Interactive node detail panels with glassmorphism allow users to click nodes and explore connections.

#### Data Management Interface (October 2025)
A comprehensive data management system provides complete CRUD operations for the knowledge graph:

**Three-Tab Interface:**
- **Browse Data**: Split view displaying Nodes and Files lists with metadata, status indicators, and click-to-view functionality
- **Create Node**: Form for manual node creation with customizable properties (name, summary, content, color, size, glow intensity)
- **Upload Files**: Multi-modal file upload supporting images, documents, CSV, JSON, text, video, and audio with automatic processing and node linking

**Cross-View Navigation:**
The interface features seamless bidirectional linking between Data Management and Network Visualization:
- Clicking a node in Browse Data automatically switches to Network view and highlights the selected node with animated selection rings and flowing particle trails
- Clicking a linked file navigates to its associated node in the cinematic visualization
- No data reload on selection - instant view transitions preserve application state

**File Processing:**
Uploaded files are automatically processed with text extraction and linked to nodes in the knowledge graph. Files display processing status badges and "Linked" indicators when associated with nodes. The system uses local storage fallback when MinIO is unavailable.

### Graph Data Model
The system models `Nodes` (messages, glyphs, entities with embeddings), `Edges` (weighted relationships with confidence scores), `Tags` (hierarchical labeling), and `Coordinates` (3D positioning). It also supports a 4D Glyph system for time-dimensional visualization.

### Native Integration
High-performance components include Rust kernels for TAA denoising via Python bindings and optional WebAssembly modules for client-side acceleration.

### User Personalization & Account Management (October 2025 Update)
The platform features a comprehensive user settings and profile management system:

**User Settings Interface:**
- **Profile Management**: Update first name, last name, email, and profile image URL
- **General Preferences**: Theme selection (dark/light), custom AI instructions for personalized assistance
- **Visualization Settings**: Adjustable force strength for graph layout, toggle node labels visibility

**Backend Architecture:**
- RESTful API endpoints at `/api/v1/user/settings` and `/api/v1/user/profile`
- User settings stored in PostgreSQL with JSONB fields for flexible preferences
- Profile updates with validation and real-time synchronization
- Tenant-scoped data isolation for multi-tenant SaaS architecture

**Interactive Onboarding:**
A 6-step interactive walkthrough guides new users through key platform features:
1. Welcome and platform introduction
2. Knowledge Network 3D visualization tour
3. Data management (browse, create, upload)
4. User settings and personalization
5. Overview dashboard and analytics
6. Completion with persistent state (localStorage)

The walkthrough features cinematic design with gradient backgrounds, progress tracking, step pagination, and seamless view transitions.

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