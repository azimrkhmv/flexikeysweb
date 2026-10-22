import asyncio
import os
from collections.abc import AsyncIterator, Iterator

import pytest

# The tests must not depend on a developer's .env file, so they set their own values first.
# Needs PostgreSQL, Redis and MinIO: `docker compose up -d db redis minio`.
TEST_DB = "flexikeys_test"
os.environ.update(
    ENV="test",
    DATABASE_URL=os.environ.get(
        "TEST_DATABASE_URL", f"postgresql+asyncpg://flexikeys:flexikeys@localhost:5433/{TEST_DB}"
    ),
    REDIS_URL="redis://localhost:6380/1",
    S3_ENDPOINT="http://localhost:9100",
    S3_ACCESS_KEY="flexikeys",  # the dev MinIO from compose.yaml
    S3_SECRET_KEY="flexikeys-dev",
    S3_BUCKET="flexikeys-test",
    JWT_SECRET="test-secret-at-least-32-bytes-long!!",
    HEALTH_KEYS="rns5GjXuzrOlYZEsm_Rpxq6AYW-NsEDRLg9XzFxbZSQ=",
    RESEARCH_PATH="",  # the real knowledge base never; tests/test_assistant_research.py brings a made-up one
)

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import make_url  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402

from app import redis  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402


async def _recreate_database(url: str) -> None:
    target = make_url(url)
    admin = create_async_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.exec_driver_sql(f'DROP DATABASE IF EXISTS "{target.database}" WITH (FORCE)')
        await conn.exec_driver_sql(f'CREATE DATABASE "{target.database}"')
    await admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    """A fresh test database for every test run, built with the real database changes (alembic upgrade head)."""
    asyncio.run(_recreate_database(os.environ["DATABASE_URL"]))
    command.upgrade(Config("alembic.ini"), "head")
    yield


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as s:
        yield s
    await engine.dispose()


@pytest.fixture(autouse=True)
def _empty_redis() -> None:
    """Every test starts with an empty Redis (database 1, never the dev one): no leftover codes or limits."""

    async def flush() -> None:
        r = redis.connect()
        await r.flushdb()
        await r.aclose()

    asyncio.run(flush())
