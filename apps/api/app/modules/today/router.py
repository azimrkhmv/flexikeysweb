"""Daily use (spec §8, §10): one tap marks an exercise done, then the parent may say how it went. A sick or very tired
child: pause today, and the plan moves forward one day."""

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.plans.models import ItemKind, Plan, PlanItem
from app.modules.plans.router import (
    TASHKENT,
    current_plan_of,
    day_dates,
    exercise_levels,
    paused_dates,
    plan_day_today,
)
from app.modules.today.models import Feeling, PausedDay, TaskDone
from app.schemas import ApiModel

router = APIRouter(prefix="/children", tags=["today"])


class DoneIn(ApiModel):
    day: int  # the plan day, 0 = the first
    exercise_id: str


class FeelingIn(ApiModel):
    feeling: Feeling


class DoneOut(ApiModel):
    id: uuid.UUID
    day: int
    exercise_id: str
    done_on: date
    feeling: Feeling | None
    level: int  # the exercise's level now, after the ratings so far


async def _out(db: AsyncSession, plan: Plan, done: TaskDone, item: PlanItem) -> DoneOut:
    level = (await exercise_levels(db, plan))[item.ref]
    return DoneOut(
        id=done.id, day=item.day, exercise_id=item.ref, done_on=done.done_on, feeling=done.feeling, level=level
    )


@router.post("/{child_id}/done", status_code=201)
async def mark_done(
    child_id: uuid.UUID,
    body: DoneIn,
    response: Response,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> DoneOut:
    """One tap: this exercise of that day of the current plan is done. Twice = once (200 with the first record).
    404 when the plan has no such exercise that day; 409 not_yet for a day still to come."""
    plan = await current_plan_of(db, user, child_id)
    item = await db.scalar(
        select(PlanItem).where(
            PlanItem.plan_id == plan.id,
            PlanItem.day == body.day,
            PlanItem.kind == ItemKind.exercise,
            PlanItem.ref == body.exercise_id,
        )
    )
    if item is None:
        raise AppError(404, "not_found")
    today = datetime.now(TASHKENT).date()
    if day_dates(plan.start_date, await paused_dates(db, plan))[item.day] > today:
        raise AppError(409, "not_yet")
    added = await db.scalar(
        insert(TaskDone)
        .values(id=uuid.uuid4(), child_id=child_id, plan_item_id=item.id, done_on=today, done_by=user.id)
        .on_conflict_do_nothing(index_elements=[TaskDone.plan_item_id])
        .returning(TaskDone.id)
    )
    await db.commit()
    if added is None:
        response.status_code = 200
    done = (await db.scalars(select(TaskDone).where(TaskDone.plan_item_id == item.id))).one()
    return await _out(db, plan, done, item)


@router.patch("/{child_id}/done/{done_id}")
async def rate_done(
    child_id: uuid.UUID,
    done_id: uuid.UUID,
    body: FeelingIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> DoneOut:
    """The optional easy / ok / hard after Done; can be changed. Two "hard" in a row lower the exercise's level, two
    "easy" raise it, unless a therapist fixed it."""
    plan = await current_plan_of(db, user, child_id)
    row = (
        await db.execute(
            select(TaskDone, PlanItem)
            .join(PlanItem, TaskDone.plan_item_id == PlanItem.id)
            .where(TaskDone.id == done_id, TaskDone.child_id == child_id, PlanItem.plan_id == plan.id)
        )
    ).one_or_none()
    if row is None:
        raise AppError(404, "not_found")
    done, item = row
    done.feeling = body.feeling
    await db.commit()
    return await _out(db, plan, done, item)


@router.post("/{child_id}/pause", status_code=204)
async def pause_today(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """Pause today (Tashkent date): nothing to do, not missed; the rest of the plan moves one day later. Twice = once.
    404 no_task_today before the plan starts or after it ends."""
    plan = await current_plan_of(db, user, child_id)
    day, _ = await plan_day_today(db, plan)
    if day is None:
        raise AppError(404, "no_task_today")
    await db.execute(
        insert(PausedDay)
        .values(id=uuid.uuid4(), plan_id=plan.id, paused_on=datetime.now(TASHKENT).date(), paused_by=user.id)
        .on_conflict_do_nothing(index_elements=[PausedDay.plan_id, PausedDay.paused_on])
    )
    await db.commit()


@router.delete("/{child_id}/pause", status_code=204)
async def resume_today(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """Undo today's pause. Nothing happens when today is not paused."""
    plan = await current_plan_of(db, user, child_id)
    today = datetime.now(TASHKENT).date()
    await db.execute(delete(PausedDay).where(PausedDay.plan_id == plan.id, PausedDay.paused_on == today))
    await db.commit()
