FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# deps first (path relative to repo-root build context)
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# FLATTEN: copy source from repo-root into /app (not /app/app)
COPY backend/app/ /app/
COPY backend/alembic.ini /app/alembic.ini
COPY backend/migrations/ /app/migrations/

EXPOSE 8000
# flat module path
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
