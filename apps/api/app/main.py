"""FlexiKeys server. Each feature lives in its own folder under `app/modules/` and exposes a `router`."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import errors, logs, redis
from app.db import engine
from app.modules.accounts import admin, helpers
from app.modules.accounts import router as accounts
from app.modules.assistant import router as assistant
from app.modules.auth import router as auth
from app.modules.billing import router as billing
from app.modules.children import consents
from app.modules.children import router as children
from app.modules.clips import router as clips
from app.modules.console import router as console
from app.modules.health import router as health
from app.modules.intake import router as intake
from app.modules.kits import router as kits
from app.modules.places import bookings, clinic
from app.modules.places import router as places
from app.modules.plans import router as plans
from app.modules.play import cards
from app.modules.play import router as play
from app.modules.privacy import router as privacy
from app.modules.therapists import form as therapist_form
from app.modules.therapists import router as therapists
from app.modules.today import router as today
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
app.include_router(helpers.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(billing.admin_router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(console.router, prefix="/api/v1")
app.include_router(console.flags_router, prefix="/api/v1")
app.include_router(places.admin_router, prefix="/api/v1")
app.include_router(places.router, prefix="/api/v1")
app.include_router(clinic.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(kits.router, prefix="/api/v1")
app.include_router(kits.admin_router, prefix="/api/v1")
app.include_router(children.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(privacy.router, prefix="/api/v1")
app.include_router(privacy.me_router, prefix="/api/v1")
app.include_router(consents.router, prefix="/api/v1")
app.include_router(intake.router, prefix="/api/v1")
app.include_router(plans.router, prefix="/api/v1")
app.include_router(today.router, prefix="/api/v1")
app.include_router(therapists.router, prefix="/api/v1")
app.include_router(therapists.therapist_router, prefix="/api/v1")
app.include_router(therapist_form.router, prefix="/api/v1")
app.include_router(therapist_form.therapist_router, prefix="/api/v1")
app.include_router(clips.router, prefix="/api/v1")
app.include_router(clips.therapist_router, prefix="/api/v1")
app.include_router(play.router, prefix="/api/v1")
app.include_router(cards.router, prefix="/api/v1")
app.include_router(videos.router, prefix="/api/v1")
app.include_router(videos.review_router, prefix="/api/v1")
app.include_router(videos.family_router, prefix="/api/v1")
