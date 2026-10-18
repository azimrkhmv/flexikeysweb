"""Plans (spec §7, §13): made by the engine from a finished question round, stored with their reasons."""

import uuid
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts.models import Lang
from app.modules.children.models import Child
from app.modules.plans import engine
from app.modules.plans.models import ItemKind, Plan, PlanItem, PlanReason
from app.modules.plans.safety import LibraryExercise
from app.modules.videos.models import Exercise, Video, VideoStatus

TASHKENT = ZoneInfo("Asia/Tashkent")


async def library(db: AsyncSession) -> list[LibraryExercise]:
    """Every active exercise, with the languages its video is approved in (no approved video = never in a plan)."""
    approved: dict[str, set[str]] = {}
    for exercise_id, lang in await db.execute(
        select(Video.exercise_id, Video.lang).where(Video.status == VideoStatus.approved)
    ):
        approved.setdefault(exercise_id, set()).add(lang.value)
    return [
        LibraryExercise(
            id=e.id,
            body_area=e.body_area,
            goals=tuple(e.goals),
            gmfcs=tuple(e.gmfcs),
            ages=tuple(e.ages),
            tool=e.tool,
            difficulty=e.difficulty,
            conflicts=tuple(e.conflicts),
            approved=frozenset(approved.get(e.id, ())),
        )
        for e in await db.scalars(select(Exercise).where(Exercise.active))
    ]


async def create_plan(
    db: AsyncSession, child: Child, round_id: uuid.UUID, answers: dict[str, Any], health_consent: bool
) -> Plan:
    """Build the 4-week plan from the round's answers and add it, with its items and reasons, to the session.
    Starts today in Tashkent. Older plans stay as the child's history; the newest is the current one."""
    start = datetime.now(TASHKENT).date()
    built = engine.build_plan(
        answers,
        await library(db),
        birth_date=child.birth_date,
        start_date=start,
        lang="uz" if child.lang == Lang.uz_cyrl else child.lang.value,
        health_consent=health_consent,
    )
    plan = Plan(
        child_id=child.id,
        round_id=round_id,
        start_date=start,
        engine_version=engine.ENGINE_VERSION,
        exercises_allowed=built.exercises_allowed,
    )
    db.add(plan)
    await db.flush()
    for d, day in enumerate(built.days):
        db.add_all(
            PlanItem(plan_id=plan.id, day=d, position=i, kind=ItemKind.exercise, ref=ref, level=level)
            for i, (ref, level) in enumerate(day.exercises)
        )
        db.add_all(
            PlanItem(plan_id=plan.id, day=d, position=i, kind=ItemKind.game, ref=kind, minutes=minutes)
            for i, (kind, minutes) in enumerate(day.games)
        )
    db.add_all(
        PlanReason(plan_id=plan.id, position=i, slot=ItemKind(r.slot), goal=r.goal, ref=r.ref, level=r.level)
        for i, r in enumerate(built.reasons)
    )
    return plan
