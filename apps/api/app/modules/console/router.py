"""The admin console's lists (A13.8): people, the overview numbers with service health, the audit log, feature flags.
Admins only (with the second step); the flags themselves are read by everyone signed in."""

import asyncio
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.models import Role, User
from app.modules.assistant.models import AiUsage
from app.modules.audit import models as audit
from app.modules.audit.models import AuditEntry
from app.modules.auth.router import UserOut
from app.modules.auth.session import CurrentUser
from app.modules.billing.models import FamilyPlan
from app.modules.children.models import Child
from app.modules.console.models import FLAGS, FeatureFlag
from app.modules.health.router import CHECKS, _run
from app.modules.play.models import GameSession
from app.schemas import ApiModel

router = APIRouter(prefix="/admin", tags=["admin"])
flags_router = APIRouter(tags=["admin"])
AI_DAYS = 14  # the overview's AI chart


class AdminUser(UserOut):
    name: str | None
    created_at: datetime


@router.get("/users")
async def users(
    _: Admin,
    db: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AdminUser]:
    """Everyone, newest first."""
    rows = await db.scalars(select(User).order_by(User.created_at.desc(), User.id).limit(limit).offset(offset))
    return [AdminUser.model_validate(u, from_attributes=True) for u in rows]


class Health(ApiModel):
    database: bool
    redis: bool


class Overview(ApiModel):
    users: int
    children: int
    paying: int  # families with paid Pro now (a trial does not count)
    sessions_week: int  # game sittings in the last 7 days
    ai_questions_by_role: dict[str, int]  # AI calls since the start, by the asker's role
    ai_questions_by_day: dict[str, int]  # YYYY-MM-DD for the last 14 days
    health: Health


@router.get("/overview")
async def overview(_: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> Overview:
    now = datetime.now(UTC)

    async def count(stmt: Select[Any]) -> int:
        return await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    by_role = await db.execute(
        select(User.role, func.count()).select_from(AiUsage).join(User, User.id == AiUsage.user_id).group_by(User.role)
    )
    day = func.date(func.timezone("Asia/Tashkent", AiUsage.created_at))
    by_day = await db.execute(
        select(day, func.count()).where(AiUsage.created_at >= now - timedelta(days=AI_DAYS)).group_by(day)
    )
    checks = await asyncio.gather(*(_run(c) for c in CHECKS.values()))
    ok = dict(zip(CHECKS, (r == "ok" for r in checks), strict=True))
    return Overview(
        users=await count(select(User.id)),
        children=await count(select(Child.id)),
        paying=await count(select(FamilyPlan.family_id).where(FamilyPlan.paid_until > now)),
        sessions_week=await count(select(GameSession.id).where(GameSession.day >= (now - timedelta(days=7)).date())),
        ai_questions_by_role={Role(r).value: n for r, n in by_role.all()},
        ai_questions_by_day={
            (d if isinstance(d, date) else date.fromisoformat(str(d))).isoformat(): n for d, n in by_day.all()
        },
        health=Health(database=ok["db"], redis=ok["redis"]),
    )


class AuditOut(ApiModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    target_id: uuid.UUID | None
    data: dict[str, Any]
    created_at: datetime


@router.get("/audit-logs")
async def audit_logs(
    _: Admin,
    db: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    target: uuid.UUID | None = None,
) -> list[AuditOut]:
    """Newest first; `target` keeps one person's, child's or order's entries."""
    stmt = select(AuditEntry).order_by(AuditEntry.created_at.desc()).limit(limit)
    if target is not None:
        stmt = stmt.where(AuditEntry.target_id == target)
    return [AuditOut.model_validate(a, from_attributes=True) for a in await db.scalars(stmt)]


class FlagOut(ApiModel):
    key: str
    enabled: bool
    description: str


async def _flags(db: AsyncSession) -> dict[str, bool]:
    stored = {f.key: f.enabled for f in await db.scalars(select(FeatureFlag))}
    return {k: stored.get(k, on) for k, (on, _) in FLAGS.items()}


@flags_router.get("/flags")
async def flags(_: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, bool]:
    """Which features are on, for every signed-in person."""
    return await _flags(db)


@router.get("/feature-flags")
async def feature_flags(_: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> list[FlagOut]:
    now = await _flags(db)
    return [FlagOut(key=k, enabled=now[k], description=d) for k, (_, d) in FLAGS.items()]


class FlagChange(ApiModel):
    key: str
    enabled: bool


@router.put("/feature-flags")
async def set_flag(body: FlagChange, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> FlagOut:
    """404 for a flag that does not exist. The change goes into the audit log."""
    if body.key not in FLAGS:
        raise AppError(404, "not_found")
    row = await db.get(FeatureFlag, body.key)
    if row is None:
        db.add(FeatureFlag(key=body.key, enabled=body.enabled))
    else:
        row.enabled = body.enabled
    audit.record(db, admin.id, "flag.changed", None, key=body.key, enabled=body.enabled)
    await db.commit()
    return FlagOut(key=body.key, enabled=body.enabled, description=FLAGS[body.key][1])
