import asyncio
from collections.abc import Awaitable, Callable

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text

from app.db import engine
from app.errors import problem
from app.settings import settings

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """The process is up. Says nothing about the database; that is /readyz."""
    return {"status": "ok"}


async def check_db() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("select 1"))


async def check_redis() -> None:
    async with Redis.from_url(settings.redis_url, socket_connect_timeout=2) as r:
        await r.ping()


CHECKS: dict[str, Callable[[], Awaitable[None]]] = {"db": check_db, "redis": check_redis}


async def _run(check: Callable[[], Awaitable[None]]) -> str:
    try:
        await asyncio.wait_for(check(), timeout=3)
        return "ok"
    except Exception:
        return "fail"


@router.get("/readyz", response_model=None)
async def readyz() -> dict[str, object] | JSONResponse:
    """Ready to serve: the database and Redis both answer. 503 otherwise, so traffic waits."""
    results = dict(zip(CHECKS, await asyncio.gather(*(_run(c) for c in CHECKS.values())), strict=True))
    if all(v == "ok" for v in results.values()):
        return {"status": "ok", "checks": results}
    return problem(503, "not_ready", checks=results)
