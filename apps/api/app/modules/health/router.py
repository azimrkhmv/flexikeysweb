from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """The process is up. Readiness (database, Redis) comes with /readyz in A0.4."""
    return {"status": "ok"}
