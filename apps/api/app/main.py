"""FlexiKeys server. Each feature lives in its own folder under `app/modules/` and exposes a `router`."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import errors, logs, redis
from app.modules.auth import router as auth
from app.modules.health import router as health
from app.settings import settings

logs.setup()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.redis = redis.connect()
    yield
    await app.state.redis.aclose()


app = FastAPI(
    title="FlexiKeys API", version="0.1.0", lifespan=lifespan, docs_url=None if settings.env == "prod" else "/docs"
)
errors.install(app)
logs.install(app)
app.include_router(health.router)
app.include_router(auth.router)
