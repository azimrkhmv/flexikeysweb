"""Redis: one client per running app, made in the app's lifespan (app/main.py)."""

from fastapi import Request
from redis.asyncio import Redis

from app.settings import settings


def connect() -> "Redis":
    return Redis.from_url(settings.redis_url, decode_responses=True)


def get_redis(request: Request) -> "Redis":
    """FastAPI dependency."""
    redis: Redis = request.app.state.redis
    return redis
