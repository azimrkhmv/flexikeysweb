"""The family's plan: Free or Pro, and the 7-day trial of Pro (spec §14)."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.models import FamilyMember, MemberRole, User
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.billing.models import FamilyPlan, Payment
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/family", tags=["plan"])
TRIAL = timedelta(days=7)


class PlanStatus(ApiModel):
    plan: Literal["free", "pro"]
    trial: bool  # Pro because of the trial
    trial_used: bool  # the family has had its trial (it is once per family)
    trial_ends_at: datetime | None
    paid_until: datetime | None


def status_of(row: FamilyPlan | None, now: datetime | None = None) -> PlanStatus:
    now = now or datetime.now(UTC)
    trial_end = row.trial_started_at + TRIAL if row and row.trial_started_at else None
    paid = row.paid_until if row else None
    pro_paid = paid is not None and paid > now
    in_trial = trial_end is not None and trial_end > now
    return PlanStatus(
        plan="pro" if pro_paid or in_trial else "free",
        trial=in_trial and not pro_paid,
        trial_used=trial_end is not None,
        trial_ends_at=trial_end,
        paid_until=paid,
    )


async def family_of(db: AsyncSession, user: User) -> tuple[uuid.UUID, MemberRole]:
    """The family this person belongs to (their own first); 404 no_family for staff and new parents."""
    row = (
        await db.execute(
            select(FamilyMember.family_id, FamilyMember.role)
            .where(FamilyMember.user_id == user.id)
            .order_by(FamilyMember.role != MemberRole.owner)
            .limit(1)
        )
    ).first()
    if row is None:
        raise AppError(404, "no_family")
    return row[0], row[1]


async def plan_of(db: AsyncSession, family_id: uuid.UUID) -> PlanStatus:
    """Free or Pro for this family now; what every Free limit (A7.2) asks."""
    return status_of(await db.get(FamilyPlan, family_id))


@router.get("/plan")
async def get_plan(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> PlanStatus:
    family_id, _ = await family_of(db, user)
    return await plan_of(db, family_id)


@router.post("/trial")
async def start_trial(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> PlanStatus:
    """The owner chooses to try Pro: 7 days, once per family (409 trial_used; 403 owner_only for a helper)."""
    family_id, role = await family_of(db, user)
    if role != MemberRole.owner:
        raise AppError(403, "owner_only")
    row = await db.get(FamilyPlan, family_id)
    if row is not None and row.trial_started_at is not None:
        raise AppError(409, "trial_used")
    if row is None:
        row = FamilyPlan(family_id=family_id)
        db.add(row)
    row.trial_started_at = datetime.now(UTC)
    await db.commit()
    return status_of(row)


# ---------------------------------------------------------------- paying (simulated until after the pilot)

MONTH = timedelta(days=30)


async def extend(db: AsyncSession, family_id: uuid.UUID, days: timedelta) -> FamilyPlan:
    """Pro for `days` more, from today or from when Pro already ends."""
    row = await db.get(FamilyPlan, family_id)
    if row is None:
        row = FamilyPlan(family_id=family_id)
        db.add(row)
    now = datetime.now(UTC)
    row.paid_until = max(now, row.paid_until or now) + days
    return row


class PaymentIn(ApiModel):
    payment_id: uuid.UUID  # made once per payment by the app; the same id sent again changes nothing
    months: int = Field(ge=1, le=12)


@router.post("/pay")
async def pay(body: PaymentIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> PlanStatus:
    """A simulated payment: the family is Pro for 30 days per month paid. Payments stay simulated until after the
    pilot (TASKS.md section 3); the production server refuses this (403 payments_not_available)."""
    if settings.env == "prod":
        raise AppError(403, "payments_not_available")
    family_id, role = await family_of(db, user)
    if role != MemberRole.owner:
        raise AppError(403, "owner_only")
    new = await db.scalar(
        insert(Payment)
        .values(id=body.payment_id, family_id=family_id, months=body.months)
        .on_conflict_do_nothing()
        .returning(Payment.id)
    )
    if new is None:  # this payment was already counted
        return status_of(await db.get(FamilyPlan, family_id))
    row = await extend(db, family_id, MONTH * body.months)
    audit.record(db, user.id, "plan.paid_simulated", family_id, months=body.months)
    await db.commit()
    return status_of(row)


admin_router = APIRouter(prefix="/admin", tags=["admin"])


class Upgrade(ApiModel):
    days: int = Field(ge=1, le=400)


@admin_router.post("/users/{user_id}/pro")
async def upgrade(
    user_id: uuid.UUID, body: Upgrade, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]
) -> PlanStatus:
    """An admin makes the family this parent owns Pro for some days (for example after a payment by hand)."""
    family_id = await db.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user_id, FamilyMember.role == MemberRole.owner)
    )
    if family_id is None:
        raise AppError(404, "no_family")
    row = await extend(db, family_id, timedelta(days=body.days))
    audit.record(db, admin.id, "plan.upgraded", family_id, days=body.days, owner=str(user_id))
    await db.commit()
    return status_of(row)
