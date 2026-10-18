"""Server commands.

    uv run python -m app.cli create-admin +998901234567    the first admin (cannot be made on the website)
    uv run python -m app.cli check-health-key              can this key read every stored health answer?
    uv run python -m app.cli load-exercises                the exercise library from app/content/exercises.json
    uv run python -m app.cli load-daily-questions          the daily question list from app/content/daily.json

In Docker: `docker compose exec api python -m app.cli ...`
"""

import asyncio
import sys

from sqlalchemy import select

from app.crypto import decrypt_json
from app.db import SessionLocal, engine
from app.errors import AppError
from app.modules.accounts.admin import create_staff
from app.modules.accounts.models import Role
from app.modules.intake.models import IntakeAnswer
from app.modules.today.router import load_daily_questions
from app.modules.videos.router import load_exercises


async def create_admin(phone: str) -> None:
    async with SessionLocal() as db:
        try:
            user = await create_staff(db, phone, Role.admin)
        except AppError as e:
            sys.exit(f"Not created: {e.code}")
        print(f"Admin created: {user.phone}. Sign in on the website with this number.")
    await engine.dispose()


async def check_health_key() -> None:
    """The restore test (docs/health-key.md): every encrypted health answer must decrypt with HEALTH_KEYS."""
    async with SessionLocal() as db:
        secrets = list(await db.scalars(select(IntakeAnswer.secret).where(IntakeAnswer.secret.is_not(None))))
    await engine.dispose()
    failed = 0
    for token in secrets:
        try:
            decrypt_json(str(token))
        except RuntimeError:
            failed += 1
    print(f"{len(secrets) - failed} of {len(secrets)} health answers readable with this key.")
    if not secrets:
        sys.exit("FAILED: this database has no health answers, so there is nothing to test.")
    if failed:
        sys.exit("FAILED: this key cannot read them. Use the backed-up key (docs/health-key.md).")


async def load_library() -> None:
    async with SessionLocal() as db:
        print(f"{await load_exercises(db)} exercises loaded.")
    await engine.dispose()


async def load_daily() -> None:
    async with SessionLocal() as db:
        print(f"{await load_daily_questions(db)} daily questions loaded.")
    await engine.dispose()


if __name__ == "__main__":
    match sys.argv[1:]:
        case ["create-admin", phone]:
            asyncio.run(create_admin(phone))
        case ["check-health-key"]:
            asyncio.run(check_health_key())
        case ["load-exercises"]:
            asyncio.run(load_library())
        case ["load-daily-questions"]:
            asyncio.run(load_daily())
        case _:
            sys.exit(__doc__)
