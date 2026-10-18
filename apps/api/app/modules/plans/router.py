"""Plans (spec §7, §13): made by the engine from a finished question round, stored with their reasons."""

import uuid
from datetime import date, datetime, timedelta
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Lang, User
from app.modules.auth.session import CurrentUser
from app.modules.children.models import Child
from app.modules.children.router import get_visible_child
from app.modules.plans import engine
from app.modules.plans.models import FixedLevel, ItemKind, Plan, PlanItem, PlanReason
from app.modules.plans.safety import LibraryExercise
from app.modules.today.models import Feeling, PausedDay, TaskDone
from app.modules.videos.models import Exercise, Video, servable
from app.schemas import ApiModel

TASHKENT = ZoneInfo("Asia/Tashkent")
router = APIRouter(prefix="/children", tags=["plans"])


async def library(db: AsyncSession) -> list[LibraryExercise]:
    """Every active exercise, with the languages its video is approved in (no approved video = never in a plan)."""
    approved: dict[str, set[str]] = {}
    for exercise_id, lang in await db.execute(select(Video.exercise_id, Video.lang).where(servable())):
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


class DoneMark(ApiModel):
    id: uuid.UUID  # for PATCH /children/{id}/done/{done_id}
    feeling: Feeling | None


class ExerciseItem(ApiModel):
    exercise_id: str
    title: dict[str, str]  # uz, ru, en
    tool: str | None  # the Home Kit tool it needs, if any
    level: int
    done: DoneMark | None  # marked done (A5.3), or not yet


class GameItem(ApiModel):
    kind: str
    minutes: int


class DayOut(ApiModel):
    day: int  # 0 = the first day, 27 = the last
    date: date  # moved one day later by each paused day before it
    exercises: list[ExerciseItem]
    games: list[GameItem]


class TodayOut(DayOut):
    paused: bool  # today is paused: nothing to do, `day` waits for tomorrow


class ReasonOut(ApiModel):
    slot: ItemKind
    goal: str
    ref: str
    level: int


class PlanOut(ApiModel):
    id: uuid.UUID
    start_date: date
    engine_version: str
    exercises_allowed: bool
    days: list[DayOut]
    reasons: list[ReasonOut]
    paused: list[date]  # the paused days; with `days` and their `done` marks this is the week view


async def current_plan_of(db: AsyncSession, user: User, child_id: uuid.UUID) -> Plan:
    await get_visible_child(db, user, child_id)  # any member of the family; 404 for everyone else
    plan = await db.scalar(select(Plan).where(Plan.child_id == child_id).order_by(Plan.created_at.desc()).limit(1))
    if plan is None:
        raise AppError(404, "no_plan")  # the first question round is not finished yet
    return plan


async def exercise_levels(db: AsyncSession, plan: Plan) -> dict[str, int]:
    """Each exercise's level now: its level in the plan, moved by the parent's easy / hard ratings, unless a
    therapist fixed it (spec §8). The stored plan items keep the level the plan was made with."""
    start: dict[str, int] = {}
    for ref, level in await db.execute(
        select(PlanItem.ref, PlanItem.level)
        .where(PlanItem.plan_id == plan.id, PlanItem.kind == ItemKind.exercise)
        .order_by(PlanItem.day, PlanItem.position)
    ):
        start.setdefault(ref, level or 1)
    feelings: dict[str, list[str | None]] = {}
    for ref, feeling in await db.execute(
        select(PlanItem.ref, TaskDone.feeling)
        .join(PlanItem, TaskDone.plan_item_id == PlanItem.id)
        .where(PlanItem.plan_id == plan.id)
        .order_by(TaskDone.created_at)
    ):
        feelings.setdefault(ref, []).append(feeling)
    fixed: dict[str, int] = {
        e: lvl
        for e, lvl in await db.execute(
            select(FixedLevel.exercise_id, FixedLevel.level).where(FixedLevel.child_id == plan.child_id)
        )
    }
    return {ref: fixed.get(ref) or engine.level_after(lvl, feelings.get(ref, [])) for ref, lvl in start.items()}


async def paused_dates(db: AsyncSession, plan: Plan) -> list[date]:
    return list(await db.scalars(select(PausedDay.paused_on).where(PausedDay.plan_id == plan.id).order_by("paused_on")))


def day_dates(start: date, paused: list[date]) -> list[date]:
    """The date of each plan day. A paused day is not missed: it moves the rest of the plan one day later (spec §10)."""
    skip, d = set(paused), start
    dates: list[date] = []
    while len(dates) < engine.DAYS:
        if d not in skip:
            dates.append(d)
        d += timedelta(days=1)
    return dates


async def _days(db: AsyncSession, plan: Plan, only: int | None = None) -> list[DayOut]:
    query = select(PlanItem).where(PlanItem.plan_id == plan.id).order_by(PlanItem.day, PlanItem.position)
    if only is not None:
        query = query.where(PlanItem.day == only)
    items = list(await db.scalars(query))
    rows = await db.execute(
        select(Exercise.id, Exercise.title, Exercise.tool).where(Exercise.id.in_({i.ref for i in items}))
    )
    info: dict[str, tuple[dict[str, str], str | None]] = {eid: (title, tool) for eid, title, tool in rows}
    levels = await exercise_levels(db, plan)
    done = {
        item_id: DoneMark(id=done_id, feeling=feeling)
        for item_id, done_id, feeling in await db.execute(
            select(TaskDone.plan_item_id, TaskDone.id, TaskDone.feeling).where(
                TaskDone.plan_item_id.in_({i.id for i in items})
            )
        )
    }
    dates = day_dates(plan.start_date, await paused_dates(db, plan))
    days = {
        d: DayOut(day=d, date=dates[d], exercises=[], games=[])
        for d in sorted({i.day for i in items} | ({only} if only is not None else set()))
    }
    for i in items:
        if i.kind == ItemKind.exercise:
            title, tool = info[i.ref]
            days[i.day].exercises.append(
                ExerciseItem(exercise_id=i.ref, title=title, tool=tool, level=levels[i.ref], done=done.get(i.id))
            )
        else:
            days[i.day].games.append(GameItem(kind=i.ref, minutes=i.minutes or 0))
    return list(days.values())


@router.get("/{child_id}/plan")
async def current_plan(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> PlanOut:
    """The child's current (newest) 4-week plan, every day, and the reasons behind it."""
    plan = await current_plan_of(db, user, child_id)
    reasons = await db.scalars(select(PlanReason).where(PlanReason.plan_id == plan.id).order_by(PlanReason.position))
    return PlanOut(
        id=plan.id,
        start_date=plan.start_date,
        engine_version=plan.engine_version,
        exercises_allowed=plan.exercises_allowed,
        days=await _days(db, plan),
        reasons=[ReasonOut(slot=r.slot, goal=r.goal, ref=r.ref, level=r.level) for r in reasons],
        paused=await paused_dates(db, plan),
    )


async def plan_day_today(db: AsyncSession, plan: Plan) -> tuple[int | None, bool]:
    """Today's plan day (Tashkent date) and whether today is paused. None when the plan has not started or is over;
    on a paused day, the plan day that waits for tomorrow."""
    today = datetime.now(TASHKENT).date()
    paused = await paused_dates(db, plan)
    if today in paused:
        return (today - plan.start_date).days - sum(p < today for p in paused), True
    dates = day_dates(plan.start_date, paused)
    return (dates.index(today) if today in dates else None), False


@router.get("/{child_id}/today")
async def today(child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> TodayOut:
    """Today's exercises and games (Tashkent date), after paused days moved the plan. On a paused day: paused, and
    nothing to do. 404 no_task_today before the plan starts or after it ends."""
    plan = await current_plan_of(db, user, child_id)
    day, paused = await plan_day_today(db, plan)
    if day is None:
        raise AppError(404, "no_task_today")
    if paused:
        return TodayOut(day=day, date=datetime.now(TASHKENT).date(), exercises=[], games=[], paused=True)
    return TodayOut(**(await _days(db, plan, only=day))[0].model_dump(), paused=False)
