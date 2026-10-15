"""Server commands. The first admin cannot be made through the website, so:

uv run python -m app.cli create-admin +998901234567
docker compose exec api python -m app.cli create-admin +998901234567
"""

import asyncio
import sys

from app.db import SessionLocal, engine
from app.errors import AppError
from app.modules.accounts.admin import create_staff
from app.modules.accounts.models import Role


async def create_admin(phone: str) -> None:
    async with SessionLocal() as db:
        try:
            user = await create_staff(db, phone, Role.admin)
        except AppError as e:
            sys.exit(f"Not created: {e.code}")
        print(f"Admin created: {user.phone}. Sign in on the website with this number.")
    await engine.dispose()


if __name__ == "__main__":
    match sys.argv[1:]:
        case ["create-admin", phone]:
            asyncio.run(create_admin(phone))
        case _:
            sys.exit(__doc__)
