from __future__ import with_statement
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
import sqlalchemy as sa

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name)

# Application and models live in the backend root (parent of alembic/)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import Base

target_metadata = Base.metadata


def get_url():
    # Keep in sync with db.py (supports DB_* when DATABASE_URL is unset)
    from db import DATABASE_URL

    return DATABASE_URL


def run_migrations_offline():
    url = get_url()
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration['sqlalchemy.url'] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        inspector = sa.inspect(connection)
        if 'alembic_version' not in inspector.get_table_names():
            # Alembic's default version table uses VARCHAR(32), but this project's
            # revision identifiers are longer. Pre-create the table wide enough
            # so fresh databases can run migrations successfully.
            connection.exec_driver_sql(
                """
                CREATE TABLE alembic_version (
                    version_num VARCHAR(50) NOT NULL PRIMARY KEY
                )
                """
            )
        else:
            columns = {col['name']: col for col in inspector.get_columns('alembic_version')}
            version_col = columns.get('version_num')
            if version_col is not None:
                col_type = str(version_col['type']).upper()
                if 'VARCHAR(32)' in col_type or col_type == 'VARCHAR(32)':
                    connection.exec_driver_sql(
                        "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(50)"
                    )
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()


