"""FlexiKeys server. Each feature lives in its own folder under `app/modules/` and exposes a `router`."""

from fastapi import FastAPI

from app.modules.health import router as health
from app.settings import settings

app = FastAPI(title="FlexiKeys API", version="0.1.0", docs_url=None if settings.env == "prod" else "/docs")
app.include_router(health.router)
