"""FlexiKeys server. Each feature lives in its own folder under `app/modules/` and exposes a `router`."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import errors, logs, redis
from app.db import engine
from app.modules.accounts import admin
from app.modules.accounts import router as accounts
from app.modules.auth import router as auth
from app.modules.children import consents
from app.modules.children import router as children
from app.modules.health import router as health
from app.modules.intake import router as intake
from app.modules.videos import router as videos
from app.settings import settings

logs.setup()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.redis = redis.connect()
    yield
    await app.state.redis.aclose()
    await engine.dispose()  # connections belong to this run's event loop


app = FastAPI(
    title="FlexiKeys API", version="0.1.0", lifespan=lifespan, docs_url=None if settings.env == "prod" else "/docs"
)
errors.install(app)
logs.install(app)
app.include_router(health.router)
# The website proxies /api/v1 to this server (apps/web/next.config.ts).
app.include_router(auth.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(children.router, prefix="/api/v1")
app.include_router(consents.router, prefix="/api/v1")
app.include_router(intake.router, prefix="/api/v1")
app.include_router(videos.router, prefix="/api/v1")
app.include_router(videos.review_router, prefix="/api/v1")
app.include_router(videos.family_router, prefix="/api/v1")
