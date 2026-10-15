"""Children: add, list, see, change, delete.

Seeing a child: any member of its family (owner or helper); everyone else gets 404 (access.py).
Adding, changing and deleting: the family's owner only (TASKS.md section 3, "Families").
"""

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import family_role, require_child_access
from app.modules.accounts.models import Family, FamilyMember, Lang, MemberRole, User
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.children.models import Child, Sex
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/children", tags=["children"])

Color = Literal["sky", "leaf", "sun", "lavender", "peach"]


class ChildIn(ApiModel):
    name: str = Field(min_length=1, max_length=40)
    birth_date: date
    sex: Sex
    color: Color | None = None
    lang: Lang = Lang.uz


class ChildChange(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    birth_date: date | None = None
    sex: Sex | None = None
    color: Color | None = None
    lang: Lang | None = None


class ChildOut(ApiModel):
    id: uuid.UUID
    family_id: uuid.UUID
    name: str
    birth_date: date
    sex: Sex
    color: str | None
    lang: Lang


def _out(child: Child) -> ChildOut:
    return ChildOut.model_validate(child, from_attributes=True)


def _check_birth_date(d: date) -> None:
    if d > date.today() or d.year < 1990:
        raise AppError(422, "invalid_birth_date")


async def get_visible_child(db: AsyncSession, user: User, child_id: uuid.UUID) -> Child:
    """The child, if this person may see it; 404 otherwise (also when the id does not exist)."""
    child = await db.get(Child, child_id)
    if child is None:
        raise AppError(404, "not_found")
    await require_child_access(db, user, child.family_id)
    return child


async def require_owner(db: AsyncSession, user: User, family_id: uuid.UUID) -> None:
    if await family_role(db, user, family_id) != MemberRole.owner:
        raise AppError(403, "owner_only")


@router.post("", status_code=201)
async def add_child(body: ChildIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> ChildOut:
    family_id = await db.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user.id, FamilyMember.role == MemberRole.owner)
    )
    if family_id is None:
        raise AppError(403, "owner_only")
    _check_birth_date(body.birth_date)
    # Lock the family row, so two adds at the same moment cannot both pass the limit.
    await db.execute(select(Family.id).where(Family.id == family_id).with_for_update())
    count = await db.scalar(select(func.count()).select_from(Child).where(Child.family_id == family_id))
    if (count or 0) >= settings.max_children_per_family:
        raise AppError(409, "too_many_children", max=settings.max_children_per_family)
    child = Child(family_id=family_id, **body.model_dump())
    db.add(child)
    await db.flush()
    audit.record(db, user.id, "child.created", child.id)
    await db.commit()
    return _out(child)


@router.get("")
async def list_children(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> list[ChildOut]:
    """The children of every family this person belongs to."""
    rows = await db.scalars(
        select(Child)
        .join(FamilyMember, FamilyMember.family_id == Child.family_id)
        .where(FamilyMember.user_id == user.id)
        .order_by(Child.created_at)
    )
    return [_out(c) for c in rows]


@router.get("/{child_id}")
async def get_child(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> ChildOut:
    return _out(await get_visible_child(db, user, child_id))


@router.patch("/{child_id}")
async def change_child(
    child_id: uuid.UUID, body: ChildChange, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> ChildOut:
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "birth_date" in changes:
        _check_birth_date(changes["birth_date"])
    for field, value in changes.items():
        setattr(child, field, value)
    await db.commit()
    return _out(child)


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """Deletes the child and, through the database, everything stored about them."""
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    audit.record(db, user.id, "child.deleted", child.id)
    await db.delete(child)
    await db.commit()
