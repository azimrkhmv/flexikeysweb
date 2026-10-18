"""The therapist form (A8.2, spec §6): T1 is the therapist's profile, T2-T11 are answers about one shared child.

A therapist's answer wins over the parent's (product rule 4): T2 replaces P12, T5 replaces P10 and P11, T6 replaces
P14 and T7 replaces P33 in the answers the plan is built from, and each replaced answer carries the therapist's name,
so the parent sees "Updated by …". When two therapists answer the same question, the newer answer is used. T9 (notes
on the parent's movement clips) lives with the clips (A8.3).

An answer stays after the share stops: a restriction a therapist gave must not quietly disappear (rule 2).
"""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import AfterValidator, Field, TypeAdapter, ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_json, encrypt_json
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import User
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.children.consents import ConsentKind, has_consent, require_consent
from app.modules.children.router import get_visible_child
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.intake.rules import QUESTIONS
from app.modules.therapists.models import Profession, TherapistAnswer, TherapistProfile
from app.modules.therapists.router import Therapist, get_shared_child
from app.modules.videos.models import Exercise
from app.schemas import ApiModel

router = APIRouter(prefix="/children", tags=["therapists"])
therapist_router = APIRouter(prefix="/therapist", tags=["therapists"])


def one_of(question: str) -> AfterValidator:
    """A value that must be one of the options of a parent question."""
    allowed = QUESTIONS[question].options or ()

    def check(v: str) -> str:
        if v not in allowed:
            raise ValueError(f"not an answer to {question}")
        return v

    return AfterValidator(check)


Level = Annotated[int, Field(ge=1, le=5)]  # GMFCS, MACS, CFCS: I-V
Text = Annotated[str, Field(min_length=1, max_length=1000)]


class CpType(ApiModel):  # T5
    type: Annotated[str, one_of("P10")] | None = None
    parts: Annotated[str, one_of("P11")] | None = None


class MustNot(ApiModel):  # T6: a checklist and text, or "nothing"
    items: list[Annotated[str, one_of("P14")]] = Field(default=[], max_length=6)
    text: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def _filled(self) -> "MustNot":
        if "nothing" in self.items and (len(self.items) > 1 or self.text.strip()):
            raise ValueError('"nothing" goes alone')
        if not self.items and not self.text.strip():
            raise ValueError("empty")
        return self


class Goals(ApiModel):  # T7: up to 3, from the P33 list or in own words
    goals: list[Annotated[str, one_of("P33")]] = Field(default=[])
    own: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(default=[])

    @model_validator(mode="after")
    def _count(self) -> "Goals":
        if not 1 <= len(self.goals) + len(self.own) <= 3:
            raise ValueError("1 to 3 goals")
        return self


class Exercises(ApiModel):  # T8: exercise ids from the library
    assign: list[str] = Field(default=[], max_length=50)
    exclude: list[str] = Field(default=[], max_length=50)

    @model_validator(mode="after")
    def _apart(self) -> "Exercises":
        if set(self.assign) & set(self.exclude):
            raise ValueError("an exercise is both assigned and excluded")
        return self


FORM: dict[str, TypeAdapter[Any]] = {
    "T2": TypeAdapter(Level),  # gross motor (GMFCS)
    "T3": TypeAdapter(Level),  # hand use (MACS)
    "T4": TypeAdapter(Level),  # communication (CFCS)
    "T5": TypeAdapter(CpType),
    "T6": TypeAdapter(MustNot),
    "T7": TypeAdapter(Goals),
    "T8": TypeAdapter(Exercises),
    "T10": TypeAdapter(Literal["weekly", "every_2_weeks", "monthly"]),  # how often progress updates come
    "T11": TypeAdapter(Text),  # a message shown on the parent dashboard
}
HEALTH = {"T2", "T3", "T4", "T5", "T6"}  # need the child's health consent, stored encrypted


def required(profession: Profession) -> list[str]:
    """Spec §6: T2, T6, T7 always; T3 for physio / LFK and OT; T4 for speech therapists."""
    extra = {Profession.physio: ["T3"], Profession.defectologist_ot: ["T3"], Profession.speech: ["T4"]}
    return sorted(["T2", "T6", "T7", *extra.get(profession, [])], key=lambda q: int(q[1:]))


# ponytail: GMFCS level to the parent's P12 words, a first mapping; to be checked with the physiotherapist (C8).
GMFCS_TO_P12 = {1: "walks", 2: "walks_help", 3: "walker", 4: "wheelchair", 5: "needs_help_sit"}


def replaces(question: str, value: Any) -> dict[str, Any]:
    """The parent answers this therapist answer replaces."""
    if question == "T2":
        return {"P12": GMFCS_TO_P12[value]}
    if question == "T5":
        return {p: value[k] for p, k in (("P10", "type"), ("P11", "parts")) if value[k] is not None}
    if question == "T6":
        items = value["items"] + (["other"] if value["text"].strip() and "other" not in value["items"] else [])
        return {"P14": items}
    if question == "T7" and value["goals"]:
        return {"P33": value["goals"]}
    return {}


REPLACING = ["T2", "T5", "T6", "T7"]


class UpdatedBy(ApiModel):
    therapist_name: str | None
    profession: Profession | None
    at: datetime


class Message(UpdatedBy):
    text: str


class InUse(ApiModel):
    answers: dict[str, Any]  # the parent's answers with the therapists' answers put in
    updated_by: dict[str, UpdatedBy]  # parent question id -> the therapist whose answer is used
    messages: list[Message]  # T11, newest first


async def _therapist_rows(
    db: AsyncSession, child_id: uuid.UUID, questions: list[str], health: bool
) -> list[tuple[str, Any, UpdatedBy]]:
    """Therapists' answers to these questions, oldest first."""
    rows = await db.execute(
        select(TherapistAnswer, User.name, TherapistProfile.profession)
        .join(User, User.id == TherapistAnswer.therapist_id)
        .outerjoin(TherapistProfile, TherapistProfile.user_id == TherapistAnswer.therapist_id)
        .where(TherapistAnswer.child_id == child_id, TherapistAnswer.question_id.in_(questions))
        .order_by(TherapistAnswer.updated_at)
    )
    return [
        (
            a.question_id,
            decrypt_json(a.secret) if a.secret else a.value,
            UpdatedBy(therapist_name=name, profession=prof, at=a.updated_at),
        )
        for a, name, prof in rows
        if health or a.question_id not in HEALTH
    ]


async def answers_in_use(
    db: AsyncSession, child_id: uuid.UUID, parent: dict[str, Any], health: bool
) -> tuple[dict[str, Any], dict[str, UpdatedBy]]:
    """The answers the plan is built from: the parent's, with every therapist answer put in (the newest wins)."""
    answers, by = dict(parent), {}
    for question, value, who in await _therapist_rows(db, child_id, REPLACING, health):
        for p, v in replaces(question, value).items():
            answers[p], by[p] = v, who
    return answers, by


async def _latest_parent_answers(db: AsyncSession, child_id: uuid.UUID) -> dict[str, Any]:
    last = await db.scalar(
        select(IntakeRound.id).where(IntakeRound.child_id == child_id).order_by(IntakeRound.number.desc()).limit(1)
    )
    rows = await db.execute(
        select(IntakeAnswer.question_id, IntakeAnswer.value, IntakeAnswer.secret).where(IntakeAnswer.round_id == last)
    )
    return {q: decrypt_json(secret) if secret else value for q, value, secret in rows}


@router.get("/{child_id}/answers-in-use")
async def in_use(child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> InUse:
    """For the parent: the latest intake answers as the plan uses them, which ones a therapist updated, and the
    therapists' messages."""
    await get_visible_child(db, user, child_id)
    health = await has_consent(db, child_id, ConsentKind.health)
    answers, by = await answers_in_use(db, child_id, await _latest_parent_answers(db, child_id), health)
    messages = [
        Message(text=v, **who.model_dump()) for _, v, who in await _therapist_rows(db, child_id, ["T11"], health)
    ]
    return InUse(answers=answers, updated_by=by, messages=messages[::-1])


# ---------------------------------------------------------------- the therapist


class ProfileIn(ApiModel):
    name: str = Field(min_length=1, max_length=80)
    profession: Profession
    workplace: str = Field(min_length=1, max_length=120)


class ProfileOut(ProfileIn):
    required: list[str]  # the form answers this profession must give


def _profile(user: User, p: TherapistProfile) -> ProfileOut:
    return ProfileOut(
        name=user.name or "", profession=p.profession, workplace=p.workplace, required=required(p.profession)
    )


@therapist_router.get("/profile")
async def get_profile(user: Therapist, db: Annotated[AsyncSession, Depends(get_session)]) -> ProfileOut:
    """T1. 404 no_profile until the therapist fills it in."""
    p = await db.get(TherapistProfile, user.id)
    if p is None:
        raise AppError(404, "no_profile")
    return _profile(user, p)


@therapist_router.put("/profile")
async def set_profile(
    body: ProfileIn, user: Therapist, db: Annotated[AsyncSession, Depends(get_session)]
) -> ProfileOut:
    p = await db.get(TherapistProfile, user.id)
    if p is None:
        p = TherapistProfile(user_id=user.id, profession=body.profession, workplace=body.workplace)
        db.add(p)
    p.profession, p.workplace, user.name = body.profession, body.workplace, body.name
    await db.commit()
    return _profile(user, p)


class FormIn(ApiModel):
    answers: dict[str, Any]  # T2-T11 -> value; null removes the answer


class FormOut(ApiModel):
    answers: dict[str, Any]  # this therapist's own answers
    missing: list[str]  # required answers still to give
    parent_answers: dict[str, Any]  # what the parent said to the questions the form confirms or corrects


async def _form(db: AsyncSession, user: User, child_id: uuid.UUID, profession: Profession) -> FormOut:
    rows = await db.scalars(
        select(TherapistAnswer).where(TherapistAnswer.child_id == child_id, TherapistAnswer.therapist_id == user.id)
    )
    mine = {a.question_id: decrypt_json(a.secret) if a.secret else a.value for a in rows}
    parent = await _latest_parent_answers(db, child_id)
    return FormOut(
        answers=mine,
        missing=[q for q in required(profession) if q not in mine],
        parent_answers={q: parent[q] for q in ("P10", "P11", "P12", "P14", "P33") if q in parent},
    )


async def _profession(db: AsyncSession, user: User) -> Profession:
    p = await db.get(TherapistProfile, user.id)
    if p is None:
        raise AppError(409, "profile_needed")  # T1 first: it decides which answers are required
    return p.profession


@therapist_router.get("/children/{child_id}/form")
async def get_form(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> FormOut:
    await get_shared_child(db, user, child_id)
    return await _form(db, user, child_id, await _profession(db, user))


@therapist_router.put("/children/{child_id}/form")
async def save_form(
    child_id: uuid.UUID, body: FormIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> FormOut:
    """Save some answers; the others stay. All valid, or nothing is saved. The answers are used at once."""
    await get_shared_child(db, user, child_id)
    profession = await _profession(db, user)
    clean: dict[str, Any] = {}
    for q, raw in body.answers.items():
        if q not in FORM:
            raise AppError(422, "invalid_answer", question=q, reason="unknown_question")
        if raw is None:
            clean[q] = None
            continue
        try:
            clean[q] = FORM[q].dump_python(FORM[q].validate_python(raw), mode="json", by_alias=True)
        except ValidationError:
            raise AppError(422, "invalid_answer", question=q) from None
    if t8 := clean.get("T8"):
        ids = set(t8["assign"]) | set(t8["exclude"])
        known = set(await db.scalars(select(Exercise.id).where(Exercise.id.in_(ids))))
        if ids - known:
            raise AppError(422, "invalid_answer", question="T8", reason="unknown_exercise")
    if HEALTH & {q for q, v in clean.items() if v is not None}:
        await require_consent(db, child_id, ConsentKind.health)
    for q, value in clean.items():
        mine = (TherapistAnswer.child_id == child_id, TherapistAnswer.therapist_id == user.id)
        if value is None:
            old = await db.scalar(select(TherapistAnswer).where(*mine, TherapistAnswer.question_id == q))
            if old:
                await db.delete(old)
            continue
        plain, secret = (None, encrypt_json(value)) if q in HEALTH else (value, None)
        stmt = insert(TherapistAnswer).values(
            id=uuid.uuid4(), child_id=child_id, therapist_id=user.id, question_id=q, value=plain, secret=secret
        )
        await db.execute(
            stmt.on_conflict_do_update(
                constraint="uq_therapist_answers_child_id",
                set_={
                    "value": stmt.excluded.value,
                    "secret": stmt.excluded.secret,
                    "updated_at": stmt.excluded.updated_at,
                },
            )
        )
    audit.record(db, user.id, "therapist.form_saved", child_id, questions=sorted(clean))
    await db.commit()
    return await _form(db, user, child_id, profession)
