"""Admin: create staff accounts, change roles, disable accounts. Every change goes into the audit log.

Only parents sign themselves up; staff get an account from an admin first, so their first SMS sign-in finds that
account instead of making them a parent by accident."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.models import Lang, Role, User, UserStatus
from app.modules.audit import models as audit
from app.modules.auth import tokens
from app.modules.auth.router import UserOut, normalize_phone
from app.schemas import ApiModel

router = APIRouter(prefix="/admin", tags=["admin"])


class NewStaff(ApiModel):
    phone: str
    role: Literal[Role.physio, Role.clinic, Role.admin]
    name: str | None = None
    lang: Lang = Lang.uz


async def create_staff(
    db: AsyncSession,
    phone: str,
    role: Role,
    name: str | None = None,
    lang: Lang = Lang.uz,
    actor: User | None = None,
) -> User:
    """Shared by the admin address and the `create-admin` command (app/cli.py, actor None)."""
    normal = normalize_phone(phone)
    if not normal:
        raise AppError(422, "invalid_phone")
    if await db.scalar(select(User.id).where(User.phone == normal)):
        raise AppError(409, "phone_taken")  # an existing person changes role with PATCH /admin/users/{id}
    user = User(phone=normal, role=role, name=name, lang=lang)
    db.add(user)
    await db.flush()
    audit.record(db, actor.id if actor else None, "user.created", user.id, role=role.value, phone=normal)
    await db.commit()
    return user


@router.post("/users", status_code=201)
async def add_staff(body: NewStaff, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> UserOut:
    """Create a physiotherapist, clinic or admin account by phone number."""
    user = await create_staff(db, body.phone, body.role, body.name, body.lang, actor=admin)
    return UserOut.model_validate(user, from_attributes=True)


class UserChange(ApiModel):
    role: Role | None = None
    status: UserStatus | None = None


@router.patch("/users/{user_id}")
async def change_user(
    user_id: uuid.UUID, body: UserChange, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]
) -> UserOut:
    """Change a person's role, or disable / enable their account. Every change goes into the audit log."""
    user = await db.get(User, user_id)
    if user is None:
        raise AppError(404, "not_found")
    if user.id == admin.id:
        raise AppError(409, "cannot_change_self")  # an admin cannot lock themselves out
    if body.role is not None and body.role != user.role:
        audit.record(db, admin.id, "user.role_changed", user.id, before=user.role.value, after=body.role.value)
        user.role = body.role
    if body.status is not None and body.status != user.status:
        audit.record(db, admin.id, f"user.{'disabled' if body.status == UserStatus.disabled else 'enabled'}", user.id)
        user.status = body.status
        if body.status == UserStatus.disabled:
            await tokens.revoke_all(db, user.id)  # signed out on every device, at once
    await db.commit()
    return UserOut.model_validate(user, from_attributes=True)
