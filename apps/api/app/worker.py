"""The background worker (ARQ): jobs that run on a schedule or after a request, outside the server.

Run: `uv run arq app.worker.WorkerSettings` (Docker Compose starts it as `worker`). New job = an async function
here, listed in `functions` (run on request) or `cron_jobs` (run on schedule).
"""

from datetime import UTC, datetime
from typing import Any, ClassVar

from arq import cron
from arq.connections import RedisSettings

from app.db import SessionLocal
from app.modules.play import tries
from app.settings import settings

HEARTBEAT_KEY = "worker:heartbeat"


async def heartbeat(ctx: dict[str, Any]) -> str:
    """Every minute: write the time, so anyone can check the worker is alive and on schedule."""
    now = datetime.now(UTC).isoformat()
    await ctx["redis"].set(HEARTBEAT_KEY, now)
    return now


async def clean_old_tries(ctx: dict[str, Any]) -> str:
    """Every night: tries older than 90 days are deleted, whole months at once (A6.2)."""
    async with SessionLocal() as db:
        dropped = await tries.clean(db, datetime.now(tries.TASHKENT).date())
    return f"dropped {len(dropped)} months"


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions: ClassVar[list[Any]] = []
    cron_jobs: ClassVar[list[Any]] = [
        cron(heartbeat, second=0, run_at_startup=True),
        cron(clean_old_tries, hour=22, minute=0, second=0),  # 03:00 in Tashkent
    ]
