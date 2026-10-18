"""Sharing a child with a therapist (spec §6, P41). The owner invites by phone number or by a one-time link; the
therapist accepts; the owner can stop the share at any time, and access ends with the next request."""

import hashlib
import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.modules.accounts.models import enum_column


class ShareStatus(StrEnum):
    invited = "invited"
    active = "active"
    stopped = "stopped"


class CareLink(IdTimeMixin, Base):
    __tablename__ = "care_links"

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    # Empty while a phone invite waits for a number that has no account yet, and for a link nobody used yet.
    therapist_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    phone: Mapped[str | None] = mapped_column(String(16), index=True)  # a phone invite
    code_hash: Mapped[str | None] = mapped_column(String(64), unique=True)  # a link invite: sha256 of its code
    status: Mapped[ShareStatus] = mapped_column(enum_column(ShareStatus), default=ShareStatus.invited)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # an invite not accepted by then is void
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


def code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def pending_for_phone(db: AsyncSession, phone: str) -> list[CareLink]:
    """Phone invites still waiting for this number (used at the first sign-in, app/modules/auth/router.py)."""
    rows = await db.scalars(
        select(CareLink).where(
            CareLink.phone == phone, CareLink.status == ShareStatus.invited, CareLink.expires_at > func.now()
        )
    )
    return list(rows)


async def link_for_code(db: AsyncSession, code: str) -> CareLink | None:
    """An unused, unexpired link invite."""
    return await db.scalar(
        select(CareLink).where(
            CareLink.code_hash == code_hash(code),
            CareLink.status == ShareStatus.invited,
            CareLink.therapist_id.is_(None),
            CareLink.expires_at > func.now(),
        )
    )


async def stop_all(db: AsyncSession, child_id: uuid.UUID) -> None:
    """When the owner takes back the `therapist_share` consent, every share of the child stops for good."""
    await db.execute(
        update(CareLink)
        .where(CareLink.child_id == child_id, CareLink.status != ShareStatus.stopped)
        .values(status=ShareStatus.stopped, stopped_at=func.now())
    )
