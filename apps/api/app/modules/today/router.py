"""Daily use (spec §8, §10): one tap marks an exercise done, then the parent may say how it went. A sick or very tired
child: pause today, and the plan moves forward one day. One short question a day updates the child's profile."""

import json
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Lang
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child
from app.modules.plans.models import ItemKind, Plan, PlanItem
from app.modules.plans.router import (
    TASHKENT,
    current_plan_of,
    day_dates,
    exercise_levels,
    paused_dates,
    plan_day_today,
)
from app.modules.today.models import DailyAnswer, DailyQuestion, Feeling, PausedDay, TaskDone
from app.modules.videos.models import Video, VideoLang, servable
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


# ---------------------------------------------------------------- the daily question (spec §10)

DAILY = Path(__file__).parents[2] / "content" / "daily.json"  # from apps/web/src/content/daily.ts


async def load_daily_questions(db: AsyncSession) -> int:
    """Add or update every question of daily.json. One that left the file is kept, inactive: old answers use it."""
    rows = [{**q, "active": True} for q in json.loads(DAILY.read_text("utf-8"))]
    stmt = insert(DailyQuestion).values(rows)
    changed = {k: stmt.excluded[k] for k in ("text", "options", "updates", "active")}
    await db.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=changed | {"updated_at": func.now()}))
    await db.execute(
        update(DailyQuestion)
        .where(DailyQuestion.id.not_in([r["id"] for r in rows]), DailyQuestion.active)
        .values(active=False)
    )
    await db.commit()
    return len(rows)


async def question_on(db: AsyncSession, day: date) -> DailyQuestion:
    """The question of that day: the list in turn, the same for everyone (like dailyQuestionOn in the website)."""
    questions = sorted(await db.scalars(select(DailyQuestion).where(DailyQuestion.active)), key=lambda q: int(q.id[1:]))
    if not questions:
        raise AppError(
            404, "no_daily_question"
        )  # the list is not loaded: uv run python -m app.cli load-daily-questions
    return questions[(day - date(1970, 1, 1)).days % len(questions)]


async def daily_updates(db: AsyncSession, child_id: uuid.UUID, since: datetime) -> dict[str, Any]:
    """The intake answers that daily answers given after `since` change: question id -> the newest answer.
    ponytail: the newest answer wins; a steadier rule (for example 3 answers in a row) if one bad day moves too much."""
    rows = await db.execute(
        select(DailyQuestion.updates, DailyAnswer.value)
        .join(DailyQuestion, DailyAnswer.question_id == DailyQuestion.id)
        .where(DailyAnswer.child_id == child_id, DailyAnswer.updated_at > since, DailyQuestion.updates.is_not(None))
        .order_by(DailyAnswer.asked_on)
    )
    return {str(question): value for question, value in rows if value is not None}


class DailyOut(ApiModel):
    date: date  # Tashkent
    question_id: str
    text: dict[str, str]  # uz, ru, en
    options: list[dict[str, Any]]  # {value, label: {uz, ru, en}}
    answer: int | None  # today's answer, if given


class DailyIn(ApiModel):
    question_id: str
    value: int


@router.get("/{child_id}/daily")
async def todays_question(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> DailyOut:
    """Today's question, and the answer if already given."""
    await get_visible_child(db, user, child_id)
    today = datetime.now(TASHKENT).date()
    q = await question_on(db, today)
    answer = await db.scalar(
        select(DailyAnswer.value).where(DailyAnswer.child_id == child_id, DailyAnswer.asked_on == today)
    )
    return DailyOut(date=today, question_id=q.id, text=q.text, options=q.options, answer=answer)


@router.put("/{child_id}/daily", status_code=204)
async def answer_question(
    child_id: uuid.UUID, body: DailyIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """Answer today's question; can be changed today. The answer updates the child's profile: the next question
    round (every 3 months) starts from it. 409 not_todays_question, 422 invalid_answer."""
    await get_visible_child(db, user, child_id)
    today = datetime.now(TASHKENT).date()
    q = await question_on(db, today)
    if body.question_id != q.id:
        raise AppError(409, "not_todays_question")
    if body.value not in [o["value"] for o in q.options]:
        raise AppError(422, "invalid_answer")
    stmt = insert(DailyAnswer).values(
        id=uuid.uuid4(), child_id=child_id, question_id=q.id, asked_on=today, value=body.value, answered_by=user.id
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[DailyAnswer.child_id, DailyAnswer.asked_on],
            set_={"value": body.value, "answered_by": user.id, "updated_at": func.now()},
        )
    )
    await db.commit()


# ---------------------------------------------------------------- videos for offline use (spec §8)


class OfflineVideo(ApiModel):
    exercise_id: str
    lang: VideoLang
    duration_s: int | None
    cache_key: str  # the same as long as the file is the same: keep one copy per key, drop keys no longer listed
    url: str  # works for 7 days, until expires_at
    expires_at: datetime


@router.get("/{child_id}/videos")
async def offline_videos(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)], lang: Lang | None = None
) -> list[OfflineVideo]:
    """The approved videos of today and the next 6 plan days, with links that work for 7 days, so the website and the
    app can download them on Wi-Fi and play them offline (spec §8). Only physio-approved files (product rule 3).
    `lang` defaults to the child's language."""
    plan = await current_plan_of(db, user, child_id)
    lang = lang or (await get_visible_child(db, user, child_id)).lang
    today = datetime.now(TASHKENT).date()
    dates = day_dates(plan.start_date, await paused_dates(db, plan))
    days = [d for d, on in enumerate(dates) if today <= on < today + timedelta(days=7)]
    exercises = select(PlanItem.ref).where(
        PlanItem.plan_id == plan.id, PlanItem.kind == ItemKind.exercise, PlanItem.day.in_(days)
    )
    video_lang = VideoLang.uz if lang == Lang.uz_cyrl else VideoLang(lang.value)
    videos = await db.scalars(
        select(Video)
        .where(Video.exercise_id.in_(exercises), Video.lang == video_lang, servable())
        .order_by(Video.exercise_id)
    )
    expires = datetime.now(UTC) + storage.OFFLINE_TTL
    return [
        OfflineVideo(
            exercise_id=v.exercise_id,
            lang=v.lang,
            duration_s=v.duration_s,
            cache_key=v.storage_key,
            url=storage.download_url(v.storage_key, storage.OFFLINE_TTL),
            expires_at=expires,
        )
        for v in videos
    ]
