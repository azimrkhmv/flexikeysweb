"""A child's consents. Only the family's owner gives or takes them back; family members can see them.

Every feature that needs one calls `require_consent` at the moment of use, so taking a consent back stops that use
right away:
- health: storing and using health answers (intake, A2.4-A2.5) and the plan's health filters;
- movement_videos: movement and feedback clips (A8.3);
- therapist_share: a therapist seeing the child (A8.1);
- voice_recording: the parent's own recorded voice on My Voice cards (G8). Taking it back deletes the recordings.
"""

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin, get_session
from app.errors import AppError
from app.modules.accounts.models import enum_column
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child, require_owner
from app.modules.play.models import forget_voices
from app.modules.therapists.models import stop_all
from app.schemas import ApiModel


class ConsentKind(StrEnum):
    health = "health"
    movement_videos = "movement_videos"
    therapist_share = "therapist_share"
    voice_recording = "voice_recording"


class ChildConsent(IdTimeMixin, Base):
    """The current state per child and kind. The full history of changes is in the audit log."""

    __tablename__ = "child_consents"
    __table_args__ = (UniqueConstraint("child_id", "kind"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    kind: Mapped[ConsentKind] = mapped_column(enum_column(ConsentKind))
    granted: Mapped[bool]
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    changed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


async def has_consent(db: AsyncSession, child_id: uuid.UUID, kind: ConsentKind) -> bool:
    granted = await db.scalar(
        select(ChildConsent.granted).where(ChildConsent.child_id == child_id, ChildConsent.kind == kind)
    )
    return bool(granted)


async def require_consent(db: AsyncSession, child_id: uuid.UUID, kind: ConsentKind) -> None:
    """Call this before any use that needs the consent. Not given (or taken back) -> 403."""
    if not await has_consent(db, child_id, kind):
        raise AppError(403, "child_consent_required", consent=kind.value)


router = APIRouter(prefix="/children", tags=["children"])


class Consents(ApiModel):
    health: bool
    movement_videos: bool
    therapist_share: bool
    voice_recording: bool


class ConsentChange(ApiModel):
    granted: bool


async def _consents(db: AsyncSession, child_id: uuid.UUID) -> Consents:
    rows = await db.execute(select(ChildConsent.kind, ChildConsent.granted).where(ChildConsent.child_id == child_id))
    state = {kind.value: False for kind in ConsentKind} | {k.value: g for k, g in rows}
    return Consents(**state)


@router.get("/{child_id}/consents")
async def get_consents(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Consents:
    await get_visible_child(db, user, child_id)
    return await _consents(db, child_id)


@router.put("/{child_id}/consents/{kind}")
async def set_consent(
    child_id: uuid.UUID,
    kind: ConsentKind,
    body: ConsentChange,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Consents:
    """Give or take back one consent. Owner only."""
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    row = await db.scalar(select(ChildConsent).where(ChildConsent.child_id == child_id, ChildConsent.kind == kind))
    now = datetime.now(UTC)
    if row is None:
        db.add(ChildConsent(child_id=child_id, kind=kind, granted=body.granted, changed_at=now, changed_by=user.id))
    elif row.granted != body.granted:
        row.granted, row.changed_at, row.changed_by = body.granted, now, user.id
    else:
        return await _consents(db, child_id)  # no change, nothing to log
    if kind == ConsentKind.therapist_share and not body.granted:
        await stop_all(db, child_id)
    if kind == ConsentKind.voice_recording and not body.granted:
        await forget_voices(db, child_id)
    audit.record(db, user.id, f"child.consent_{'given' if body.granted else 'withdrawn'}", child_id, kind=kind.value)
    await db.commit()
    return await _consents(db, child_id)
