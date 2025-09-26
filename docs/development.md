# Development Setup

1. Create a virtual environment and install requirements from `backend/requirements.txt`.
2. Start local infrastructure using `docker-compose up -d` for PostgreSQL, Redis, Kafka, and Redpanda.
3. Run the FastAPI server: `uvicorn app.main:app --reload` from `backend/app`.
4. Execute tests using `pytest` for worker components and `pytest -k "not integration"` for backend modules.
5. Use `scripts/staged_stack_up.sh` to build confidence before deploying changes. The script performs local smoke tests, brings each Compose stage online (database, message bus, MinIO, backend, workers, frontend, and optionally the edge proxy), and validates their health checks as it goes.
6. Use `make format` (if configured) to apply formatting standards.
7. Update OpenAPI contract fragments in `packages/contracts` whenever API routes change.
