"""Saving intake answers, a few at a time, so a parent can stop and continue later.

A round uses one question set for good: P1-P41 (spec §5, "p41") or the CEO's questionnaire (IQ2, by its date).
New rounds take settings.intake_questionnaire.

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

from app import storage
from app.crypto import decrypt_json, encrypt_json
from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.consents import ConsentKind, has_consent, require_consent
from app.modules.children.router import get_visible_child
from app.modules.intake import questionnaire
from app.modules.intake.bridge import rules_view
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.intake.rules import QUESTIONS, check_answer, missing_answers
from app.modules.plans.router import TASHKENT, create_plan
from app.modules.therapists.form import answers_in_use, therapist_input
from app.modules.today.router import daily_updates
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/children", tags=["intake"])


class AnswersIn(ApiModel):
    answers: dict[str, Any]  # question id -> value; null = "Not sure"


class RoundOut(ApiModel):
    number: int
    questionnaire: str  # "p41" (P1-P41) or the CEO's questionnaire's date: the questions this round asks
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
        found = IntakeRound(child_id=child_id, number=1, questionnaire=settings.intake_questionnaire)
        db.add(found)
        await db.flush()
        return found
    raise AppError(404, "not_found")


async def _out(db: AsyncSession, r: IntakeRound) -> RoundOut:
    rows = await db.execute(
        select(IntakeAnswer.question_id, IntakeAnswer.value, IntakeAnswer.secret).where(IntakeAnswer.round_id == r.id)
    )
    answers = {qid: decrypt_json(secret) if secret else value for qid, value, secret in rows}
    return RoundOut(number=r.number, questionnaire=r.questionnaire, completed_at=r.completed_at, answers=answers)


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
    r = await _round(db, child_id, number, create_first=True)  # a new round is only kept if everything below holds
    if r.completed_at is not None:
        raise AppError(409, "round_finished")
    health_of: dict[str, bool] = {}  # all valid, or nothing is saved
    if r.questionnaire == "p41":
        health_of = {q.id: q.health for q in (check_answer(qid, v) for qid, v in body.answers.items())}
        voice = body.answers.get("P39_voice")
        if voice is not None and not (voice.startswith(f"children/{child_id}/p39/") and storage.exists(voice)):
            raise AppError(422, "invalid_answer", question="P39_voice", reason="not_uploaded")  # this child's, uploaded
    else:
        for qid, value in body.answers.items():
            q = questionnaire.check_answer(qid, value)
            health_of[qid] = q["health"]
            if (
                q["kind"] == "file"
                and value
                and not all(key.startswith(f"children/{child_id}/intake/") and storage.exists(key) for key in value)
            ):
                raise AppError(422, "invalid_answer", question=qid, reason="not_uploaded")  # this child's, uploaded
    if any(health_of.values()):
        await require_consent(db, child_id, ConsentKind.health)
    for qid, health in health_of.items():
        value = body.answers[qid]
        # Health answers: encrypted in `secret`, never readable in `value` (A2.5). "Not sure" stays empty.
        plain, secret = (None, None if value is None else encrypt_json(value)) if health else (value, None)
        stmt = insert(IntakeAnswer).values(
            id=uuid.uuid4(), round_id=r.id, question_id=qid, value=plain, secret=secret, answered_by=user.id
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
    """Close the round once every required question has an answer ("Not sure" counts), and build the plan (A4.4)."""
    child = await get_visible_child(db, user, child_id)
    r = await _round(db, child_id, number)
    if r.completed_at is not None:
        raise AppError(409, "round_finished")
    answers = (await _out(db, r)).answers
    health = await has_consent(db, child_id, ConsentKind.health)
    today = datetime.now(TASHKENT).date()
    if r.questionnaire == "p41":
        missing = missing_answers(answers, health)
    else:
        missing = questionnaire.missing_answers(answers, health, today)
    if missing:
        raise AppError(422, "round_incomplete", missing=missing)
    r.completed_at = datetime.now(UTC)
    rules = rules_view(r.questionnaire, answers, today)  # the CEO's questionnaire read as P answers (IQ3)
    used, _ = await answers_in_use(db, child_id, rules, health)  # a therapist's answer wins (A8.2)
    therapist = await therapist_input(db, child_id, health)
    await create_plan(db, child, r.id, used, health, therapist)  # in the same transaction: always a plan with a round
    await db.commit()
    return await _out(db, r)


@router.post("/{child_id}/intake", status_code=201)
async def start_next_round(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> RoundOut:
    """The repeat every 3 months: a new round, filled in with last time's answers, updated by the daily questions
    answered since, for the parent to check."""
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
    new = IntakeRound(child_id=child_id, number=last.number + 1, questionnaire=settings.intake_questionnaire)
    db.add(new)
    await db.flush()
    keep_health = await has_consent(db, child_id, ConsentKind.health)
    daily = await daily_updates(db, child_id, since=last.completed_at)  # the profile moved by the daily questions
    old = await db.scalars(select(IntakeAnswer).where(IntakeAnswer.round_id == last.id))

    def health_question(qid: str) -> bool | None:
        """True or False when the new round asks this question, None when it does not."""
        if new.questionnaire == "p41":
            return QUESTIONS[qid].health if qid in QUESTIONS else None
        q = questionnaire.QUESTIONS.get(qid)
        return q["health"] if q and q["audience"] == "parent" else None

    for a in old:  # a switch of question set keeps only the questions both sets share (none for P1-P41)
        health = health_question(a.question_id)
        if health is not None and (keep_health or not health):
            db.add(
                IntakeAnswer(
                    round_id=new.id,
                    question_id=a.question_id,
                    value=daily.get(a.question_id, a.value),
                    secret=a.secret,
                    answered_by=a.answered_by,
                )
            )
    await db.commit()
    return await _out(db, new)


class VoiceLink(ApiModel):
    storage_key: str  # the P39_voice answer, once the file is uploaded
    upload_url: str  # PUT the recording here within 10 minutes


@router.post("/{child_id}/intake/voice-link")
async def voice_link(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> VoiceLink:
    """Where to upload the parent's P39 voice note (at most 2 minutes), straight to storage."""
    await get_visible_child(db, user, child_id)
    key = f"children/{child_id}/p39/{uuid.uuid4()}"
    return VoiceLink(storage_key=key, upload_url=storage.upload_url(key))


class VoiceNote(ApiModel):
    url: str  # a 15-minute link to listen to it


@router.get("/{child_id}/intake/{number}/voice")
async def voice_note(
    child_id: uuid.UUID, number: int, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> VoiceNote:
    """The round's P39 voice note, for every member of the family; 404 when there is none."""
    await get_visible_child(db, user, child_id)
    key = (await _out(db, await _round(db, child_id, number))).answers.get("P39_voice")
    if not key:
        raise AppError(404, "not_found")
    return VoiceNote(url=storage.download_url(key))


class FileLink(ApiModel):
    storage_key: str  # put it in the answer (a list of keys) once the file is uploaded
    upload_url: str  # PUT the file here within 10 minutes


@router.post("/{child_id}/intake/file-link")
async def file_link(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> FileLink:
    """Where to upload a document or photo for a questionnaire answer (B10, B13, CP21, DD3, I4), straight to storage."""
    await get_visible_child(db, user, child_id)
    key = f"children/{child_id}/intake/{uuid.uuid4()}"
    return FileLink(storage_key=key, upload_url=storage.upload_url(key))
