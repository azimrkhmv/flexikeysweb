"""Saving intake answers, a few at a time, so a parent can stop and continue later.

Any member of the child's family may answer (the helper too: "answer the questions", TASKS.md section 3).
Health questions need the child's health consent; without it nothing in the request is saved.
"""

import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.consents import ConsentKind, require_consent
from app.modules.children.router import get_visible_child
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.intake.rules import check_answer
from app.schemas import ApiModel

router = APIRouter(prefix="/children", tags=["intake"])


class AnswersIn(ApiModel):
    answers: dict[str, Any]  # question id -> value; null = "Not sure"


class RoundOut(ApiModel):
    number: int
    completed_at: datetime | None
    answers: dict[str, Any]  # a question that is missing here is not answered yet


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
    rows = await db.execute(select(IntakeAnswer.question_id, IntakeAnswer.value).where(IntakeAnswer.round_id == r.id))
    return RoundOut(number=r.number, completed_at=r.completed_at, answers={q: v for q, v in rows})


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
    for qid, value in body.answers.items():
        stmt = insert(IntakeAnswer).values(
            id=uuid.uuid4(), round_id=r.id, question_id=qid, value=value, answered_by=user.id
        )
        await db.execute(
            stmt.on_conflict_do_update(
                constraint="uq_intake_answers_round_id",
                set_={"value": stmt.excluded.value, "answered_by": user.id, "updated_at": stmt.excluded.updated_at},
            )
        )
    await db.commit()
    return await _out(db, r)
