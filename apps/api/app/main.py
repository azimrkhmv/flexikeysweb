"""FlexiKeys server. Each feature lives in its own folder under `app/modules/` and exposes a `router`."""

from fastapi import FastAPI

from app.modules.health import router as health

app = FastAPI(title="FlexiKeys API", version="0.1.0")
app.include_router(health.router)
