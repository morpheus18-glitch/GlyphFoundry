from __future__ import annotations
import os, sys
from logging.config import fileConfig
from alembic import context
from sqlalchemy import create_engine, pool

# Alembic Config
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Make /app importable inside the container
if "/app" not in sys.path:
    sys.path.insert(0, "/app")

# Import models + settings
try:
    from models import Base  # /app/models.py
except Exception as e:
    Base = None
target_metadata = getattr(Base, "metadata", None)

# Prefer env var, else app settings
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    try:
        from settings import settings
        database_url = settings.database_url
    except Exception:
        pass

if not database_url:
    raise RuntimeError("DATABASE_URL not set and settings.database_url missing")

def run_migrations_offline():
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = create_engine(
        database_url,
        poolclass=pool.NullPool,
        future=True,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
