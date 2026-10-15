"""Saving intake answers, a few at a time, so a parent can stop and continue later.

Any member of the child's family may answer (the helper too: "answer the questions", TASKS.md section 3).
Health questions need the child's health consent; without it nothing in the request is saved.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_json, encrypt_json
from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.consents import ConsentKind, has_consent, require_consent
from app.modules.children.router import get_visible_child
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.intake.rules import QUESTIONS, check_answer, missing_answers
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/children", tags=["intake"])


class AnswersIn(ApiModel):
    answers: dict[str, Any]  # question id -> value; null = "Not sure"


class RoundOut(ApiModel):
    number: int
    completed_at: datetime | None
    answers: dict[str, Any]  # a question that is missing here is not answered yet


class RoundSummary(ApiModel):
    number: int
    started_at: datetime
    completed_at: datetime | None


async def _round(db: AsyncSession, child_id: uuid.UUID, number: int, *, create_first: bool = False) -> IntakeRound:
    found = await db.scalar(select(IntakeRound).where(IntakeRound.child_id == child_id, IntakeRound.number == number))
    if found:
        return found
    if create_first and number == 1:  # round 1 starts with the first saved answer; later rounds start in A2.7
        found = IntakeRound(child_id=child_id, number=1)
        db.add(found)
        await db.flush()
        return found
    raise AppError(404, "not_found")


async def _out(db: AsyncSession, r: IntakeRound) -> RoundOut:
    rows = await db.execute(
        select(IntakeAnswer.question_id, IntakeAnswer.value, IntakeAnswer.secret).where(IntakeAnswer.round_id == r.id)
    )
    answers = {qid: decrypt_json(secret) if secret else value for qid, value, secret in rows}
    return RoundOut(number=r.number, completed_at=r.completed_at, answers=answers)


@router.get("/{child_id}/intake/{number}")
async def get_round(
    child_id: uuid.UUID, number: int, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> RoundOut:
    """The answers saved so far, to continue where the parent stopped."""
    await get_visible_child(db, user, child_id)
    return await _out(db, await _round(db, child_id, number))


@router.put("/{child_id}/intake/{number}")
async def save_answers(
    child_id: uuid.UUID,
    number: int,
    body: AnswersIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> RoundOut:
    """Save some answers. Answers already saved for other questions stay; the same question is overwritten."""
    await get_visible_child(db, user, child_id)
    questions = [check_answer(qid, value) for qid, value in body.answers.items()]  # all valid, or nothing is saved
    if any(q.health for q in questions):
        await require_consent(db, child_id, ConsentKind.health)
    r = await _round(db, child_id, number, create_first=True)
    if r.completed_at is not None:
        raise AppError(409, "round_finished")
    for q in questions:
        value = body.answers[q.id]
        # Health answers: encrypted in `secret`, never readable in `value` (A2.5). "Not sure" stays empty.
        plain, secret = (None, None if value is None else encrypt_json(value)) if q.health else (value, None)
        stmt = insert(IntakeAnswer).values(
            id=uuid.uuid4(), round_id=r.id, question_id=q.id, value=plain, secret=secret, answered_by=user.id
        )
        await db.execute(
            stmt.on_conflict_do_update(
                constraint="uq_intake_answers_round_id",
                set_={
                    "value": stmt.excluded.value,
                    "secret": stmt.excluded.secret,
                    "answered_by": user.id,
                    "updated_at": stmt.excluded.updated_at,
                },
            )
        )
    await db.commit()
    return await _out(db, r)


@router.get("/{child_id}/intake")
async def list_rounds(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[RoundSummary]:
    """Every round of this child, oldest first. Old rounds are never deleted (the child's history)."""
    await get_visible_child(db, user, child_id)
    rounds = await db.scalars(select(IntakeRound).where(IntakeRound.child_id == child_id).order_by(IntakeRound.number))
    return [RoundSummary(number=r.number, started_at=r.created_at, completed_at=r.completed_at) for r in rounds]


@router.post("/{child_id}/intake/{number}/finish")
async def finish_round(
    child_id: uuid.UUID, number: int, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> RoundOut:
    """Close the round once every required question has an answer ("Not sure" counts)."""
    await get_visible_child(db, user, child_id)
    r = await _round(db, child_id, number)
    if r.completed_at is not None:
        raise AppError(409, "round_finished")
    answers = (await _out(db, r)).answers
    if missing := missing_answers(answers, await has_consent(db, child_id, ConsentKind.health)):
        raise AppError(422, "round_incomplete", missing=missing)
    r.completed_at = datetime.now(UTC)
    await db.commit()
    return await _out(db, r)


@router.post("/{child_id}/intake", status_code=201)
async def start_next_round(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> RoundOut:
    """The repeat every 3 months: a new round, filled in with last time's answers for the parent to check."""
    await get_visible_child(db, user, child_id)
    last = await db.scalar(
        select(IntakeRound).where(IntakeRound.child_id == child_id).order_by(IntakeRound.number.desc()).limit(1)
    )
    if last is None:
        raise AppError(409, "no_first_round")  # round 1 starts by saving answers
    if last.completed_at is None:
        raise AppError(409, "round_open", number=last.number)
    ready = last.completed_at + timedelta(days=settings.intake_repeat_days)
    if datetime.now(UTC) < ready:
        raise AppError(409, "too_early", fromDate=ready.date().isoformat())
    new = IntakeRound(child_id=child_id, number=last.number + 1)
    db.add(new)
    await db.flush()
    keep_health = await has_consent(db, child_id, ConsentKind.health)
    old = await db.scalars(select(IntakeAnswer).where(IntakeAnswer.round_id == last.id))
    for a in old:
        if a.question_id in QUESTIONS and (keep_health or not QUESTIONS[a.question_id].health):
            db.add(
                IntakeAnswer(
                    round_id=new.id,
                    question_id=a.question_id,
                    value=a.value,
                    secret=a.secret,
                    answered_by=a.answered_by,
                )
            )
    await db.commit()
    return await _out(db, new)
