from __future__ import annotations

import os
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy import create_engine
from alembic import context

# Import your models metadata
from app.models import Base
target_metadata = Base.metadata

config = context.config

# DB URL from environment (fallback to your default)
db_url = os.getenv("DATABASE_URL", "postgresql+psycopg://gf_user:gf_pass@gf_postgres:5432/glyph_foundry")
config.set_main_option("sqlalchemy.url", db_url)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---- Tell Alembic how to render Vector() ----
try:
    from pgvector.sqlalchemy import Vector
    from alembic.autogenerate import renderers

    @renderers.dispatch_for(Vector)
    def _render_vector_type(autogen_context, type_):
        dim = getattr(type_, "dim", getattr(type_, "dimensions", None))
        if dim is None:
            return "Vector()"
        return f"Vector(dim={int(dim)})"
except Exception:
    pass

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = create_engine(config.get_main_option("sqlalchemy.url"), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
