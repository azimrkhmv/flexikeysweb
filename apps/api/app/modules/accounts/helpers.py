"""Helpers (A8.4): the owner invites one second adult by phone; that person accepts; the owner removes them.

A helper is for daily use only (TASKS.md section 3): answer the questions, mark tasks done, play, use the assistant.
Everything only the owner may do is checked with `require_owner` (children/router.py) or the owner role, so a helper
gets 403 owner_only there. Removing a helper deletes their family membership, and every child address checks it on
each request, so access ends at once.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Family, FamilyMember, HelperInvite, MemberRole, Role, User
from app.modules.audit import models as audit
from app.modules.auth.router import normalize_phone
from app.modules.auth.session import CurrentUser
from app.modules.billing.router import family_of
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(tags=["helpers"])
INVITE_TTL = timedelta(days=7)


class HelperIn(ApiModel):
    phone: str


class InviteOut(ApiModel):
    id: uuid.UUID
    phone: str
    expires_at: datetime


class HelperOut(ApiModel):
    user_id: uuid.UUID
    name: str | None
    phone: str
    since: datetime


class Helpers(ApiModel):
    family_id: uuid.UUID  # the family these are of (the person's own family first)
    helpers: list[HelperOut]
    invites: list[InviteOut]  # not yet accepted, not expired


class InviteForMe(ApiModel):
    id: uuid.UUID
    owner_name: str | None
    expires_at: datetime


async def _own_family(db: AsyncSession, user: User) -> uuid.UUID:
    family_id, role = await family_of(db, user)
    if role != MemberRole.owner:
        raise AppError(403, "owner_only")
    return family_id


async def _helper_count(db: AsyncSession, family_id: uuid.UUID) -> int:
    count = select(func.count()).where(FamilyMember.family_id == family_id, FamilyMember.role == MemberRole.helper)
    return await db.scalar(count) or 0


async def _helpers(db: AsyncSession, family_id: uuid.UUID) -> Helpers:
    members = await db.execute(
        select(FamilyMember, User)
        .join(User, User.id == FamilyMember.user_id)
        .where(FamilyMember.family_id == family_id, FamilyMember.role == MemberRole.helper)
        .order_by(FamilyMember.created_at)
    )
    invites = await db.scalars(
        select(HelperInvite)
        .where(HelperInvite.family_id == family_id, HelperInvite.expires_at > func.now())
        .order_by(HelperInvite.created_at)
    )
    return Helpers(
        family_id=family_id,
        helpers=[HelperOut(user_id=u.id, name=u.name, phone=u.phone, since=m.created_at) for m, u in members],
        invites=[InviteOut(id=i.id, phone=i.phone, expires_at=i.expires_at) for i in invites],
    )


@router.post("/family/helpers", status_code=201)
async def invite_helper(
    body: HelperIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> InviteOut:
    """Owner only. 409 too_many_helpers (the limit is a setting, 1 now), already_member, already_invited,
    not_a_parent (staff and therapists cannot be helpers)."""
    family_id = await _own_family(db, user)
    phone = normalize_phone(body.phone)
    if not phone:
        raise AppError(422, "invalid_phone")
    if await _helper_count(db, family_id) >= settings.max_helpers_per_family:
        raise AppError(409, "too_many_helpers", max=settings.max_helpers_per_family)
    person = await db.scalar(select(User).where(User.phone == phone))
    if person is not None:
        if person.role != Role.parent:
            raise AppError(409, "not_a_parent")
        member = select(FamilyMember.id).where(FamilyMember.family_id == family_id, FamilyMember.user_id == person.id)
        if await db.scalar(member):
            raise AppError(409, "already_member")
    open_invite = select(HelperInvite.id).where(
        HelperInvite.family_id == family_id, HelperInvite.phone == phone, HelperInvite.expires_at > func.now()
    )
    if await db.scalar(open_invite):
        raise AppError(409, "already_invited")
    invite = HelperInvite(
        family_id=family_id, phone=phone, invited_by=user.id, expires_at=datetime.now(UTC) + INVITE_TTL
    )
    db.add(invite)
    await db.flush()
    audit.record(db, user.id, "family.helper_invited", family_id, invite=str(invite.id))
    await db.commit()
    return InviteOut(id=invite.id, phone=phone, expires_at=invite.expires_at)


@router.get("/family/helpers")
async def list_helpers(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> Helpers:
    """The helpers and open invites of the family this person belongs to (their own first)."""
    family_id, _ = await family_of(db, user)
    return await _helpers(db, family_id)


@router.delete("/family/helpers/{user_id}", status_code=204)
async def remove_helper(
    user_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    """Owner only. The helper's next request already gets "not found" for the family's children."""
    family_id = await _own_family(db, user)
    gone = await db.execute(
        delete(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == user_id,
            FamilyMember.role == MemberRole.helper,
        )
    )
    if not gone.rowcount:  # type: ignore[attr-defined]
        raise AppError(404, "not_found")
    audit.record(db, user.id, "family.helper_removed", family_id, helper=str(user_id))
    await db.commit()
    return Response(status_code=204)


@router.delete("/family/helper-invites/{invite_id}", status_code=204)
async def cancel_invite(
    invite_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    family_id = await _own_family(db, user)
    gone = await db.execute(
        delete(HelperInvite).where(HelperInvite.id == invite_id, HelperInvite.family_id == family_id)
    )
    if not gone.rowcount:  # type: ignore[attr-defined]
        raise AppError(404, "not_found")
    await db.commit()
    return Response(status_code=204)


@router.get("/me/helper-invites")
async def my_invites(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> list[InviteForMe]:
    """Invites to help in another family, made for this person's number."""
    rows = await db.execute(
        select(HelperInvite, User.name)
        .join(
            FamilyMember, (FamilyMember.family_id == HelperInvite.family_id) & (FamilyMember.role == MemberRole.owner)
        )
        .join(User, User.id == FamilyMember.user_id)
        .where(HelperInvite.phone == user.phone, HelperInvite.expires_at > func.now())
        .order_by(HelperInvite.created_at)
    )
    return [InviteForMe(id=i.id, owner_name=name, expires_at=i.expires_at) for i, name in rows]


@router.post("/me/helper-invites/{invite_id}/accept")
async def accept_invite(
    invite_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Helpers:
    """Join the family as its helper. The family's children then appear in GET /children."""
    invite = await db.get(HelperInvite, invite_id)
    if invite is None or invite.phone != user.phone or invite.expires_at <= datetime.now(UTC):
        raise AppError(404, "invite_not_found")
    if user.role != Role.parent:
        raise AppError(409, "not_a_parent")
    # Lock the family row, so two accepts at the same moment cannot both pass the limit.
    await db.execute(select(Family.id).where(Family.id == invite.family_id).with_for_update())
    if await _helper_count(db, invite.family_id) >= settings.max_helpers_per_family:
        raise AppError(409, "too_many_helpers", max=settings.max_helpers_per_family)
    member = select(FamilyMember.id).where(FamilyMember.family_id == invite.family_id, FamilyMember.user_id == user.id)
    if await db.scalar(member):
        raise AppError(409, "already_member")
    family_id = invite.family_id
    db.add(FamilyMember(family_id=family_id, user_id=user.id, role=MemberRole.helper))
    await db.delete(invite)
    audit.record(db, user.id, "family.helper_joined", family_id)
    await db.commit()
    return await _helpers(db, family_id)
