"""Sharing a child with a therapist (A8.1, spec §6).

The owner: invite by phone or by a one-time link (needs the child's `therapist_share` consent), see the shares, stop
one. The therapist: see invites, accept one, see the shared children.

A share gives the therapist the child only through `get_shared_child` here; the family addresses (`get_visible_child`)
stay closed to them. Every request checks the share again, so stopping it, or taking back the consent, cuts access at
once. Every time a therapist opens a child it goes into the audit log.
"""

import secrets
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import require_role
from app.modules.accounts.models import Lang, Role, User
from app.modules.audit import models as audit
from app.modules.auth.router import normalize_phone
from app.modules.auth.session import CurrentUser
from app.modules.auth.sms import SmsSender, get_sms
from app.modules.billing.router import is_pro, require_pro
from app.modules.children.consents import ConsentKind, has_consent, require_consent
from app.modules.children.models import Child, Sex
from app.modules.children.router import get_visible_child, require_owner
from app.modules.therapists.models import CareLink, ShareStatus, code_hash, link_for_code
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/children", tags=["therapists"])
therapist_router = APIRouter(prefix="/therapist", tags=["therapists"])
Therapist = Annotated[User, Depends(require_role(Role.therapist))]

INVITE_TTL = timedelta(days=7)
MAX_OPEN = 5  # open invites and shares per child
# G9: a phone invite tells the therapist by SMS, in the inviting parent's language. No child's name: an SMS passes
# through the provider. The invite waits for that number, so signing in is all the therapist does.
INVITE_SMS = {
    Lang.uz: "FlexiKeys: sizni bolaning terapevti sifatida taklif qilishdi. Shu raqam bilan kiring: {url}",
    Lang.ru: "FlexiKeys: вас пригласили как терапевта ребёнка. Войдите с этим номером: {url}",  # noqa: RUF001
    Lang.en: "FlexiKeys: a family invites you as their child's therapist. Sign in with this number: {url}",
}


# ---------------------------------------------------------------- the owner


class TherapistInvite(ApiModel):
    phone: str | None = None  # empty: a one-time link instead


class ShareOut(ApiModel):
    id: uuid.UUID
    status: ShareStatus
    phone: str | None  # the invited number, or the therapist's once they accepted
    therapist_name: str | None
    invited_at: datetime
    expires_at: datetime  # for an invite; an accepted share does not expire
    accepted_at: datetime | None
    code: str | None = None  # only in the answer that creates a link invite, never again


async def _out(db: AsyncSession, link: CareLink) -> ShareOut:
    therapist = await db.get(User, link.therapist_id) if link.therapist_id else None
    return ShareOut(
        id=link.id,
        status=link.status,
        phone=therapist.phone if therapist and link.status == ShareStatus.active else link.phone,
        therapist_name=therapist.name if therapist else None,
        invited_at=link.created_at,
        expires_at=link.expires_at,
        accepted_at=link.accepted_at,
    )


@router.post("/{child_id}/therapists", status_code=201)
async def invite(
    child_id: uuid.UUID,
    body: TherapistInvite,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    sms: Annotated[SmsSender, Depends(get_sms)],
) -> ShareOut:
    """Invite a therapist to see this child. Owner only; needs the `therapist_share` consent. A phone invite sends
    the therapist an SMS with the sign-in link; a link invite sends nothing (the parent passes the link on)."""
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    await require_consent(db, child_id, ConsentKind.therapist_share)
    await require_pro(db, child_id, free_allows=settings.free_therapist_sharing)
    open_links = select(CareLink).where(CareLink.child_id == child_id, CareLink.status != ShareStatus.stopped)
    if len((await db.scalars(open_links)).all()) >= MAX_OPEN:
        raise AppError(409, "too_many_shares", max=MAX_OPEN)
    link = CareLink(child_id=child_id, invited_by=user.id, expires_at=datetime.now(UTC) + INVITE_TTL)
    code = None
    if body.phone is not None:
        phone = normalize_phone(body.phone)
        if not phone:
            raise AppError(422, "invalid_phone")
        person = await db.scalar(select(User).where(User.phone == phone))
        if person is not None and person.role != Role.therapist:
            raise AppError(409, "not_a_therapist")  # one number, one role; an admin can change the role
        same = CareLink.phone == phone
        if person is not None:
            same |= CareLink.therapist_id == person.id
        if await db.scalar(open_links.where(same)):
            raise AppError(409, "already_invited")
        link.phone, link.therapist_id = phone, person.id if person else None
    else:
        code = secrets.token_urlsafe(16)
        link.code_hash = code_hash(code)
    db.add(link)
    await db.flush()
    audit.record(
        db, user.id, "child.therapist_invited", child_id, link=str(link.id), by="phone" if code is None else "link"
    )
    await db.commit()
    await db.refresh(link)
    if link.phone:
        await sms.send(link.phone, INVITE_SMS[user.lang].format(url=f"{settings.site_url}/login"))
    return (await _out(db, link)).model_copy(update={"code": code})


@router.get("/{child_id}/therapists")
async def shares(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[ShareOut]:
    """Open invites and active shares of this child, oldest first."""
    await get_visible_child(db, user, child_id)
    rows = await db.scalars(
        select(CareLink)
        .where(CareLink.child_id == child_id, CareLink.status != ShareStatus.stopped)
        .order_by(CareLink.created_at)
    )
    return [await _out(db, link) for link in rows]


@router.delete("/{child_id}/therapists/{link_id}", status_code=204)
async def stop(
    child_id: uuid.UUID, link_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    """Stop a share or take back an invite. Owner only. The therapist's next request already gets "not found"."""
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    link = await db.get(CareLink, link_id)
    if link is None or link.child_id != child_id or link.status == ShareStatus.stopped:
        raise AppError(404, "not_found")
    link.status, link.stopped_at = ShareStatus.stopped, datetime.now(UTC)
    audit.record(db, user.id, "child.therapist_stopped", child_id, link=str(link.id))
    await db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- the therapist


class InviteOut(ApiModel):
    id: uuid.UUID
    child_name: str
    expires_at: datetime


class SharedChild(ApiModel):
    id: uuid.UUID
    name: str
    birth_date: date
    sex: Sex
    lang: Lang
    shared_since: datetime


class Accept(ApiModel):
    code: str


async def get_shared_child(db: AsyncSession, user: User, child_id: uuid.UUID) -> tuple[Child, CareLink]:
    """The child, if it is shared with this therapist right now; 404 otherwise, like a child that does not exist."""
    found = (
        await db.execute(
            select(Child, CareLink)
            .join(CareLink, CareLink.child_id == Child.id)
            .where(
                Child.id == child_id,
                CareLink.therapist_id == user.id,
                CareLink.status == ShareStatus.active,
            )
        )
    ).first()
    if user.role != Role.therapist or found is None or not await has_consent(db, child_id, ConsentKind.therapist_share):
        raise AppError(404, "not_found")
    if not settings.free_therapist_sharing and not await is_pro(db, child_id):
        raise AppError(403, "pro_only")  # the family is on Free now: the share waits until it is on Pro again
    return found[0], found[1]


def _shared(child: Child, link: CareLink) -> SharedChild:
    return SharedChild(
        id=child.id,
        name=child.name,
        birth_date=child.birth_date,
        sex=child.sex,
        lang=child.lang,
        shared_since=link.accepted_at or link.created_at,
    )


async def _accept(db: AsyncSession, user: User, link: CareLink | None) -> SharedChild:
    if link is None or link.expires_at <= datetime.now(UTC):
        raise AppError(404, "invite_not_found")
    already = await db.scalar(
        select(CareLink.id).where(
            CareLink.child_id == link.child_id,
            CareLink.therapist_id == user.id,
            CareLink.status == ShareStatus.active,
        )
    )
    if already:
        raise AppError(409, "already_shared")
    link.therapist_id, link.status, link.accepted_at = user.id, ShareStatus.active, datetime.now(UTC)
    audit.record(db, user.id, "child.therapist_accepted", link.child_id, link=str(link.id))
    await db.commit()
    child, link = await get_shared_child(db, user, link.child_id)
    return _shared(child, link)


@therapist_router.get("/invites")
async def my_invites(user: Therapist, db: Annotated[AsyncSession, Depends(get_session)]) -> list[InviteOut]:
    """Phone invites waiting for this therapist."""
    rows = await db.execute(
        select(CareLink, Child.name)
        .join(Child, Child.id == CareLink.child_id)
        .where(
            CareLink.therapist_id == user.id,
            CareLink.status == ShareStatus.invited,
            CareLink.expires_at > func.now(),
        )
        .order_by(CareLink.created_at)
    )
    return [InviteOut(id=link.id, child_name=name, expires_at=link.expires_at) for link, name in rows]


@therapist_router.post("/invites/accept")
async def accept_link(body: Accept, user: Therapist, db: Annotated[AsyncSession, Depends(get_session)]) -> SharedChild:
    """Accept a link invite. The code works once."""
    return await _accept(db, user, await link_for_code(db, body.code))


@therapist_router.post("/invites/{link_id}/accept")
async def accept_phone(
    link_id: uuid.UUID, user: Therapist, db: Annotated[AsyncSession, Depends(get_session)]
) -> SharedChild:
    """Accept a phone invite made for this therapist's number."""
    link = await db.get(CareLink, link_id)
    mine = link is not None and link.therapist_id == user.id and link.status == ShareStatus.invited
    return await _accept(db, user, link if mine else None)


@therapist_router.get("/children")
async def my_children(user: Therapist, db: Annotated[AsyncSession, Depends(get_session)]) -> list[SharedChild]:
    """The children shared with this therapist right now."""
    rows = await db.execute(
        select(Child, CareLink)
        .join(CareLink, CareLink.child_id == Child.id)
        .where(CareLink.therapist_id == user.id, CareLink.status == ShareStatus.active)
        .order_by(CareLink.accepted_at)
    )
    return [
        _shared(child, link) for child, link in rows if await has_consent(db, child.id, ConsentKind.therapist_share)
    ]


@therapist_router.get("/children/{child_id}")
async def my_child(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> SharedChild:
    """One shared child. Anyone else, and a therapist whose share stopped, gets "not found"."""
    child, link = await get_shared_child(db, user, child_id)
    audit.record(db, user.id, "therapist.child_viewed", child_id)
    await db.commit()
    return _shared(child, link)
