# Development Setup

1. Create a virtual environment and install requirements from `backend/requirements.txt`.
2. Start local infrastructure using `docker-compose up -d` for PostgreSQL, Redis, Kafka, and Redpanda.
3. Run the FastAPI server: `uvicorn app.main:app --reload` from `backend/app`.
4. Execute tests using `pytest` for worker components and `pytest -k "not integration"` for backend modules.
5. Use `make format` (if configured) to apply formatting standards.
6. Update OpenAPI contract fragments in `packages/contracts` whenever API routes change.
