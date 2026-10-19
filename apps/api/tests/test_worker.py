"""A5.2: the background worker runs its scheduled job."""

import asyncio

import pytest
from arq.worker import Worker

from app import redis
from app.worker import HEARTBEAT_KEY, WorkerSettings

pytestmark = pytest.mark.anyio


async def test_the_scheduled_job_runs() -> None:
    worker = Worker(
        functions=WorkerSettings.functions,
        cron_jobs=WorkerSettings.cron_jobs,
        redis_settings=WorkerSettings.redis_settings,
        burst=True,  # stop once nothing is left to do
        poll_delay=0.1,
        handle_signals=False,
    )
    try:
        await asyncio.wait_for(worker.async_run(), timeout=10)
    finally:
        await worker.close()
    beat, clean, _reminders = WorkerSettings.cron_jobs  # reminders: tests/test_visit_reminders.py
    assert beat.second == 0 and beat.minute is None  # at the start of every minute
    assert (clean.name, clean.hour, clean.minute) == ("cron:clean_old_tries", 22, 0)  # 03:00 in Tashkent (A6.2)
    assert worker.jobs_complete == 1 and worker.jobs_failed == 0
    r = redis.connect()
    try:
        assert await r.get(HEARTBEAT_KEY)
    finally:
        await r.aclose()
