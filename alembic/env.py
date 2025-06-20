import os
import sys
from pathlib import Path

from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# This is the Alembic Config object, which provides
# access to values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add the project root to the sys.path
# This is crucial so Alembic can find your 'app' module
sys.path.append(str(Path(__file__).resolve().parents[2]))

# Import your Base and models here
from app.database.database import Base

# IMPORTANT: Import ALL your models here so Alembic can discover them
from app.database.models import User, PasswordResetToken

# target_metadata is where you define the Base for your models.
target_metadata = Base.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,  # Crucial for PostGIS
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,  # Crucial for PostGIS
        )

        with context.begin_transaction():
            context.run_migrations()


# Function to filter out PostGIS and other unmanaged tables during autogenerate
def include_object(object, name, type_, reflected, compare_to):
    """
    Filter objects (like tables) during autogenerate.
    This function tells Alembic to ignore specific tables that are part of database extensions
    or are managed externally.
    """
    # List of table names to EXCLUDE from Alembic's management
    # Add any tables here that are not defined in your SQLAlchemy models
    # but exist in your database (e.g., PostGIS internal tables, or data imports)
    EXCLUDE_TABLES = (
        "geography_columns",
        "geometry_columns",
        "spatial_ref_sys",
        "nsw_addresses",
        "nsw_lots",
        "nsw_landzones",
        "nsw_roads",
        "offers_summary",
        # Add any other tables that Alembic tries to drop/alter unnecessarily
    )

    if type_ == "table" and name in EXCLUDE_TABLES:
        return False  # Exclude these tables

    return True  # Include all other objects


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
