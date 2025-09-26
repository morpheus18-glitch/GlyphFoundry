# Deployment Guide

1. **Install Dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Configure Environment**
   - Set `APP_ENV`, `LOG_LEVEL`, and database credentials.
   - Provide Kafka and Redis URLs if they differ from defaults.

3. **Apply Database Schema**
   - Run `python db/scripts/setup.py` to initialize the database.
   - Apply SQL migrations located in `db/migrations/`.

4. **Start Services**
   - Launch the FastAPI backend with `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
   - Start workers as needed, e.g. `python workers/embeddings/main.py`.

5. **Observability**
   - Scrape `/metrics` with Prometheus.
   - Inspect Kafka `quantum.state` topic for orchestrator snapshots.
   - Monitor Redis keys `worker:heartbeat:*` for worker liveness.
