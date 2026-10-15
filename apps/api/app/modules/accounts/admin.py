"""Admin: create staff accounts. Only parents sign themselves up; staff get an account from an admin first,
so their first SMS sign-in finds that account instead of making them a parent by accident."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.models import Lang, Role, User
from app.modules.auth.router import UserOut, normalize_phone
from app.schemas import ApiModel

router = APIRouter(prefix="/admin", tags=["admin"])


class NewStaff(ApiModel):
    phone: str
    role: Literal[Role.physio, Role.clinic, Role.admin]
    name: str | None = None
    lang: Lang = Lang.uz


async def create_staff(db: AsyncSession, phone: str, role: Role, name: str | None = None, lang: Lang = Lang.uz) -> User:
    """Shared by the admin address and the `create-admin` command (app/cli.py)."""
    normal = normalize_phone(phone)
    if not normal:
        raise AppError(422, "invalid_phone")
    if await db.scalar(select(User.id).where(User.phone == normal)):
        raise AppError(409, "phone_taken")  # changing an existing person's role is A1.8, on purpose separate
    user = User(phone=normal, role=role, name=name, lang=lang)
    db.add(user)
    await db.commit()
    return user


@router.post("/users", status_code=201)
async def add_staff(body: NewStaff, _: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> UserOut:
    """Create a physiotherapist, clinic or admin account by phone number."""
    user = await create_staff(db, body.phone, body.role, body.name, body.lang)
    return UserOut.model_validate(user, from_attributes=True)
