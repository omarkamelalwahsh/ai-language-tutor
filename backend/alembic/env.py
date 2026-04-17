from logging.config import fileConfig
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

from sqlalchemy import create_engine, pool
from alembic import context

# Ensure the backend root is on sys.path so `app.*` imports work
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

# Load .env from the backend directory
load_dotenv(BASE_DIR / ".env")

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Build the sync Alembic URL from DATABASE_URL in .env
# Alembic needs a DIRECT connection (port 5432), not the pooler (6543)
raw_url = os.getenv("DATABASE_URL", "")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)
# Force psycopg2 sync driver for Alembic (not asyncpg)
SYNC_URL = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Import Base and all models so Alembic can detect them
from app.db.database import Base
import app.models  # triggers import of all model classes

target_metadata = Base.metadata

# --- Schema filtering ---
# Only manage tables in the 'public' schema.
# Never touch Supabase-managed schemas: auth, storage, realtime, vault, extensions, etc.
EXCLUDED_SCHEMAS = {"auth", "storage", "realtime", "vault", "extensions", "pgsodium", "graphql", "graphql_public", "supabase_functions", "supabase_migrations", "information_schema", "pg_catalog"}


def include_object(object, name, type_, reflected, compare_to):
    """Filter out Supabase-managed objects from autogenerate."""
    # Always skip objects in excluded schemas
    if hasattr(object, "schema") and object.schema in EXCLUDED_SCHEMAS:
        return False
    # For tables, check schema
    if type_ == "table":
        schema = getattr(object, "schema", None)
        if schema in EXCLUDED_SCHEMAS:
            return False
        # Skip the auth.users table entirely (we only reference it via FK)
        if schema == "auth":
            return False
    # For columns on auth.users, skip
    if type_ == "column" and hasattr(object, "table"):
        tbl = object.table
        if getattr(tbl, "schema", None) in EXCLUDED_SCHEMAS:
            return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=SYNC_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_schemas=False,  # Only public schema
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Create engine directly from the URL to bypass configparser % escaping issues
    connectable = create_engine(SYNC_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=False,  # Only public schema
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()