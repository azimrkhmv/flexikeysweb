"""The pilot numbers and the centre links (B113, Update 4 spec 4). Admins only (with the second step)."""

import re
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.models import FamilyMember, MemberRole, Role, User
from app.modules.audit import models as audit
from app.modules.billing.models import ManualPayment
from app.modules.children.models import Child
from app.modules.pilot import rules
from app.modules.pilot.models import CenterLink
from app.modules.play.models import Try
from app.modules.play.tries import TASHKENT
from app.modules.today.models import TaskDone
from app.schemas import ApiModel

router = APIRouter(prefix="/admin", tags=["pilot"])

CODE = re.compile(r"^[a-z0-9][a-z0-9-]{1,31}$")


def clean_code(raw: str | None) -> str | None:
    """A ref code as the website sends it: trimmed, lowercase; None if it cannot be one."""
    code = (raw or "").strip().lower()
    return code if CODE.fullmatch(code) else None


async def link_for(db: AsyncSession, raw: str | None) -> CenterLink | None:
    code = clean_code(raw)
    return (await db.execute(select(CenterLink).where(CenterLink.code == code))).scalar_one_or_none() if code else None


# ---------------------------------------------------------------- centre links


class CenterLinkIn(ApiModel):
    name: str = Field(min_length=1, max_length=80)
    code: str = Field(min_length=2, max_length=32)


class CenterLinkOut(ApiModel):
    id: uuid.UUID
    name: str
    code: str
    created_at: datetime
    signups: int  # parents who finished sign-up with this code


async def _links(db: AsyncSession) -> list[CenterLinkOut]:
    counts = dict(
        (
            await db.execute(
                select(User.ref_code, func.count()).where(User.ref_code.is_not(None)).group_by(User.ref_code)
            )
        ).all()
    )
    rows = (await db.scalars(select(CenterLink).order_by(CenterLink.created_at))).all()
    return [
        CenterLinkOut(id=r.id, name=r.name, code=r.code, created_at=r.created_at, signups=counts.get(r.code, 0))
        for r in rows
    ]


@router.get("/center-links")
async def center_links(_: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> list[CenterLinkOut]:
    """Every centre link, oldest first, with how many parents signed up through it."""
    return await _links(db)


@router.post("/center-links", status_code=201)
async def add_center_link(
    body: CenterLinkIn, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[CenterLinkOut]:
    """A new centre link. 422 invalid_ref_code (lowercase letters, digits and "-", 2-32), 409 code_taken."""
    code = clean_code(body.code)
    if not code:
        raise AppError(422, "invalid_ref_code")
    link = CenterLink(name=body.name.strip(), code=code)
    db.add(link)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "code_taken") from None
    audit.record(db, admin.id, "center_link.created", link.id, code=code)
    await db.commit()
    return await _links(db)


# ---------------------------------------------------------------- pilot numbers


class DayCount(ApiModel):
    day: date
    count: int


class RegionCount(ApiModel):
    region: str | None  # None: no region given
    count: int


class CenterCount(ApiModel):
    code: str | None  # None: "no link"
    name: str | None
    count: int


class QuietFamily(ApiModel):
    user_id: uuid.UUID
    name: str | None
    phone: str
    region: str | None
    district: str | None
    ref_code: str | None
    signed_up: date
    last_active: date | None  # None: never finished an exercise or a game


class PilotOut(ApiModel):
    today: date  # Tashkent
    signed_up: int  # parents who finished sign-up
    signups_by_day: list[DayCount]
    by_region: list[RegionCount]
    by_center: list[CenterCount]
    retained: int  # families retained by the 2.3 rule (app/modules/pilot/rules.py)
    quiet: list[QuietFamily]
    revenue_uzs: int  # every payment taken by hand (B114)
    paying_families: int  # families with at least one


async def active_days(db: AsyncSession) -> dict[uuid.UUID, set[date]]:
    """Per family, the Tashkent days with a finished exercise or game: a task marked done or a game try."""
    days: dict[uuid.UUID, set[date]] = defaultdict(set)
    done = select(Child.family_id, TaskDone.done_on).join(Child, Child.id == TaskDone.child_id).distinct()
    tried = (
        select(Child.family_id, func.date(func.timezone(TASHKENT.key, Try.ts)))
        .join(Child, Child.id == Try.child_id)
        .distinct()
    )
    for family_id, day in [*(await db.execute(done)).all(), *(await db.execute(tried)).all()]:
        days[family_id].add(day)
    return days


@router.get("/pilot")
async def pilot(_: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> PilotOut:
    """Sign-ups per day, region and centre link; retained families; quiet families to call (spec 4.3)."""
    today = datetime.now(TASHKENT).date()
    parents = (
        await db.execute(
            select(User, FamilyMember.family_id)
            .join(FamilyMember, (FamilyMember.user_id == User.id) & (FamilyMember.role == MemberRole.owner))
            .where(User.role == Role.parent, User.consent_at.is_not(None))
            .order_by(User.consent_at)
        )
    ).all()
    days = await active_days(db)
    names = dict((await db.execute(select(CenterLink.code, CenterLink.name))).all())
    signed_on = {u.id: u.consent_at.astimezone(TASHKENT).date() for u, _ in parents if u.consent_at}
    by_day = Counter(signed_on.values())
    by_region = Counter(u.region for u, _ in parents)
    by_center = Counter(u.ref_code for u, _ in parents)
    quiet = [
        QuietFamily(
            user_id=u.id,
            name=u.name,
            phone=u.phone,
            region=u.region,
            district=u.district,
            ref_code=u.ref_code,
            signed_up=signed_on[u.id],
            last_active=rules.last_active(days.get(f, set()), today),
        )
        for u, f in parents
        if rules.is_quiet(days.get(f, set()), today)
    ]
    revenue, paying = (
        await db.execute(
            select(
                func.coalesce(func.sum(ManualPayment.amount_uzs), 0), func.count(func.distinct(ManualPayment.family_id))
            )
        )
    ).one()
    return PilotOut(
        today=today,
        signed_up=len(parents),
        signups_by_day=[DayCount(day=d, count=n) for d, n in sorted(by_day.items())],
        by_region=[RegionCount(region=r, count=n) for r, n in by_region.most_common()],
        by_center=[CenterCount(code=c, name=names.get(c) if c else None, count=n) for c, n in by_center.most_common()],
        retained=sum(rules.is_retained(days.get(f, set()), today) for _, f in parents),
        quiet=sorted(quiet, key=lambda q: q.last_active or date.min),
        revenue_uzs=int(revenue),
        paying_families=int(paying),
    )
