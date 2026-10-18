"""Alembic runs database changes with the server's own settings and table definitions."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app import models  # noqa: F401  # registers every table on Base.metadata
from app.db import Base
from app.modules.play.tries import PREFIX
from app.settings import settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def include_object(obj: object, name: str | None, kind: str, reflected: bool, compare_to: object) -> bool:
    """The monthly parts of the tries table are made and dropped by the server (app/modules/play/tries.py)."""
    return not (kind == "table" and reflected and (name or "").startswith(PREFIX))


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True, include_object=include_object
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations() -> None:
    engine = create_async_engine(settings.database_url, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


asyncio.run(run_migrations())
