"""A9.5: the weekly two-sentence summary and the plan explanation (spec §12, §13). AI only writes the friendly
sentences, and only from the facts it is given: a text with a number that is not among the facts, a percentage or
more than three sentences is thrown away and a fixed sentence is used instead. Never the child's name.

Each text is kept in Redis for a week per child, week (or plan) and language, so the AI is asked once."""

import json
import re
import uuid
from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Lang
from app.modules.assistant.ai import Ai, get_ai, over_budget
from app.modules.assistant.models import AiPurpose, AiUsage
from app.modules.auth.session import CurrentUser
from app.modules.children.consents import ConsentKind, has_consent
from app.modules.children.models import Child
from app.modules.plans.models import ItemKind, PlanItem, PlanReason
from app.modules.plans.router import TASHKENT, current_plan_of
from app.modules.therapists.form import therapist_input
from app.modules.today.models import Feeling, PausedDay, TaskDone
from app.redis import get_redis
from app.schemas import ApiModel

router = APIRouter(tags=["assistant"])
KEEP = timedelta(days=7)

GOAL_WORDS = {
    "walk": "walking more steadily", "hands": "using the hands", "sit": "sitting", "communicate": "communicating",
    "understand": "understanding", "eat": "eating", "play_others": "playing with others",
    "school": "getting ready for school",
}  # fmt: skip
LANG_NAME = {
    Lang.uz: "Uzbek (Latin script)",
    Lang.uz_cyrl: "Uzbek (Cyrillic script)",
    Lang.ru: "Russian",
    Lang.en: "English",
}
WRITE = (
    "Write {what} for a parent of a child with cerebral palsy, in {lang}, in at most two short, warm, plain "
    "sentences. Use ONLY these facts; add nothing else: {facts}. Write numbers as digits. No scores, no "
    "percentages, no comparing with other children, no diagnosis, no medical advice. Call the child 'your child'."
)


class WeekFacts(ApiModel):
    days_with_tasks: int  # of the last 7
    exercises_done: int
    games_done: int
    felt_easy: int
    felt_ok: int
    felt_hard: int
    days_paused: int


class PlanFacts(ApiModel):
    goals: list[str]  # in the plan's order
    exercises_allowed: bool  # False: games only, until the health questions or a therapist make exercises safe
    different_exercises: int
    therapist_involved: bool


class Written(ApiModel):
    text: str
    written_by: Literal["ai", "template"]


FALLBACK = {
    "week": {
        Lang.en: "This week your child did tasks on {days_with_tasks} of 7 days. Keep going at your own pace.",
        Lang.ru: "На этой неделе ваш ребёнок выполнял задания {days_with_tasks} дн. из 7. Продолжайте в своём темпе.",
        Lang.uz: "Bu hafta farzandingiz 7 kundan {days_with_tasks} kunida vazifa bajardi. Oʻz sur'atingizda davom eting.",
        Lang.uz_cyrl: "Бу ҳафта фарзандингиз 7 кундан {days_with_tasks} кунида вазифа бажарди. Ўз суръатингизда давом "
        "этинг.",
    },
    "plan": {
        Lang.en: "The plan is built from your answers and what your child's therapist set. Each day has short exercises "
        "and games chosen to be safe for your child.",
        Lang.ru: "План составлен по вашим ответам и указаниям терапевта ребёнка. Каждый день — короткие упражнения и "
        "игры, безопасные для вашего ребёнка.",
        Lang.uz: "Reja sizning javoblaringiz va terapevt koʻrsatmalari asosida tuzilgan. Har kuni farzandingiz uchun "
        "xavfsiz qisqa mashqlar va oʻyinlar bor.",
        Lang.uz_cyrl: "Режа сизнинг жавобларингиз ва терапевт кўрсатмалари асосида тузилган. Ҳар куни фарзандингиз учун "
        "хавфсиз қисқа машқлар ва ўйинлар бор.",
    },
}


def only_given(text: str, facts: BaseModel) -> bool:
    """The text keeps to the facts: every number in it is one of the facts (or the 7 days of a week), no percentage,
    at most three sentences. ponytail: numbers written as words are not checked; the AI is told to use digits."""
    allowed = {str(v) for v in facts.model_dump().values() if isinstance(v, int) and not isinstance(v, bool)} | {"7"}
    numbers = set(re.findall(r"\d+", text))
    sentences = len(re.findall(r"[.!?。](\s|$)", text.strip() + " "))
    return bool(text.strip()) and numbers <= allowed and "%" not in text and sentences <= 3


async def _write(
    db: AsyncSession, redis: Redis, ai: Ai, child: Child, user_id: uuid.UUID, kind: Literal["week", "plan"],
    key: str, facts: BaseModel, what: str, lang: Lang,
) -> Written:  # fmt: skip
    cache = f"ai:{kind}:{child.id}:{key}:{lang.value}"
    if hit := await redis.get(cache):
        return Written.model_validate_json(hit)
    words = facts.model_dump()
    if "goals" in words:
        words["goals"] = [GOAL_WORDS.get(g, g) for g in words["goals"]]
    prompt = WRITE.format(what=what, lang=LANG_NAME[lang], facts=json.dumps(words))
    try:
        if await over_budget(db):  # A9.6
            raise AppError(503, "ai_over_budget")
        reply = await ai.chat([{"role": "user", "content": prompt}])
    except AppError:  # the AI did not answer, or the month's money is spent: the fixed sentence, not cached
        return Written(text=FALLBACK[kind][lang].format(**facts.model_dump()), written_by="template")
    purpose = AiPurpose.weekly_summary if kind == "week" else AiPurpose.plan_explanation
    db.add(
        AiUsage(
            family_id=child.family_id, user_id=user_id, purpose=purpose, model=reply.model,
            input_tokens=reply.input_tokens, output_tokens=reply.output_tokens, cost_usd=reply.cost_usd,
        )
    )  # fmt: skip
    await db.commit()
    ok = only_given(reply.text, facts)
    out = Written(
        text=reply.text if ok else FALLBACK[kind][lang].format(**facts.model_dump()),
        written_by="ai" if ok else "template",
    )
    await redis.set(cache, out.model_dump_json(), ex=KEEP)
    return out


class WeekSummary(Written):
    week_start: datetime
    facts: WeekFacts


@router.get("/children/{child_id}/weekly-summary")
async def weekly_summary(
    child_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    redis: Annotated[Redis, Depends(get_redis)],
    ai: Annotated[Ai, Depends(get_ai)],
    lang: Lang = Lang.uz,
) -> WeekSummary:
    """The last 7 days (Tashkent), in two sentences. Free and Pro. 404 no_plan before the first plan."""
    plan = await current_plan_of(db, user, child_id)
    child = await db.get(Child, child_id)
    assert child is not None  # noqa: S101 (current_plan_of found it)
    today = datetime.now(TASHKENT).date()
    start = today - timedelta(days=6)
    done = (
        await db.execute(
            select(TaskDone.done_on, PlanItem.kind, TaskDone.feeling)
            .join(PlanItem, PlanItem.id == TaskDone.plan_item_id)
            .where(TaskDone.child_id == child_id, TaskDone.done_on >= start)
        )
    ).all()
    paused = await db.scalar(select(func.count()).where(PausedDay.plan_id == plan.id, PausedDay.paused_on >= start))
    facts = WeekFacts(
        days_with_tasks=len({d.done_on for d in done}),
        exercises_done=sum(d.kind == ItemKind.exercise for d in done),
        games_done=sum(d.kind == ItemKind.game for d in done),
        felt_easy=sum(d.feeling == Feeling.easy for d in done),
        felt_ok=sum(d.feeling == Feeling.ok for d in done),
        felt_hard=sum(d.feeling == Feeling.hard for d in done),
        days_paused=paused or 0,
    )
    # Facts change during the week: the key holds them, so a new done task gives a new text.
    key = ":".join([start.isoformat(), *(str(v) for v in facts.model_dump().values())])
    what = "this week's summary of home practice"
    out = await _write(db, redis, ai, child, user.id, "week", key, facts, what, lang)
    week_start = datetime.combine(start, datetime.min.time(), TASHKENT)
    return WeekSummary(**out.model_dump(), week_start=week_start, facts=facts)


class PlanExplanation(Written):
    facts: PlanFacts


@router.get("/children/{child_id}/plan-explanation")
async def plan_explanation(
    child_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    redis: Annotated[Redis, Depends(get_redis)],
    ai: Annotated[Ai, Depends(get_ai)],
    lang: Lang = Lang.uz,
) -> PlanExplanation:
    """Why the current plan is what it is, in two sentences. 404 no_plan before the first plan."""
    plan = await current_plan_of(db, user, child_id)
    child = await db.get(Child, child_id)
    assert child is not None  # noqa: S101
    goals = list(
        dict.fromkeys(
            await db.scalars(select(PlanReason.goal).where(PlanReason.plan_id == plan.id).order_by(PlanReason.position))
        )
    )
    different = await db.scalar(
        select(func.count(distinct(PlanItem.ref))).where(
            PlanItem.plan_id == plan.id, PlanItem.kind == ItemKind.exercise
        )
    )
    facts = PlanFacts(
        goals=goals,
        exercises_allowed=plan.exercises_allowed,
        different_exercises=different or 0,
        therapist_involved=await therapist_input(db, child_id, await has_consent(db, child_id, ConsentKind.health))
        is not None,
    )
    what = "an explanation of why the child's 4-week home plan looks the way it does"
    out = await _write(db, redis, ai, child, user.id, "plan", str(plan.id), facts, what, lang)
    return PlanExplanation(**out.model_dump(), facts=facts)
