"""The therapist form (A8.2, spec §6): T1 is the therapist's profile, T2-T11 are answers about one shared child.

A therapist's answer wins over the parent's (product rule 4): T2 replaces P12, T5 replaces P10 and P11, T6 replaces
P14 and T7 replaces P33 in the answers the plan is built from, and each replaced answer carries the therapist's name,
so the parent sees "Updated by …". When two therapists answer the same question, the newer answer is used; but every
therapist's restrictions (T6) and excluded exercises (T8) count. T9 (notes on the parent's movement clips) lives with
the clips (A8.3).

A change to T2, T5, T6, T7 or T8 rebuilds the plan at once (A8.5).

IQ6: "L" holds the therapist's assessment of the CEO's questionnaire (section L: date, GMFM scores, trunk control,
goals, aids, hand function, massage areas). Its L2 (GMFCS) is T2 and its L9 (restrictions) is T6. A T6 answer also
replaces the questionnaire's red flags: the hold ("until a therapist has looked") ends and the therapist's restrictions
are the ones used (rule 4). The scores are for therapists only and never reach the parent (rule 1).

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
from app.modules.children.models import Child
from app.modules.children.router import get_visible_child
from app.modules.intake import questionnaire
from app.modules.intake.bridge import rules_view
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.intake.rules import QUESTIONS
from app.modules.plans.router import TASHKENT, create_plan
from app.modules.plans.safety import P14_TAGS, plan_facts
from app.modules.plans.safety import Therapist as TherapistInput
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


def must_not(v: str) -> str:
    """P14's options, and "high_intensity" (L9's "maximum effort": no hard exercise)."""
    if v not in (*(QUESTIONS["P14"].options or ()), "high_intensity"):
        raise ValueError("not a restriction")
    return v


class MustNot(ApiModel):  # T6 (L9): a checklist and text, or "nothing"
    items: list[Annotated[str, AfterValidator(must_not)]] = Field(default=[], max_length=7)
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


SECTION_L = [
    q for q, v in questionnaire.QUESTIONS.items() if v["audience"] == "therapist" and q not in ("L2", "L9")
]  # L2 is T2, L9 is T6


def section_l(v: dict[str, Any]) -> dict[str, Any]:
    """The therapist's section L answers, each checked like a questionnaire answer."""
    if not v:
        raise ValueError("empty")
    for q, answer in v.items():
        if q not in SECTION_L or questionnaire.problem_with(questionnaire.QUESTIONS[q], answer):
            raise ValueError(f"not an answer to {q}")
    return v


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
    "L": TypeAdapter(Annotated[dict[str, Any], AfterValidator(section_l)]),  # IQ6: section L of the questionnaire
}
HEALTH = {"T2", "T3", "T4", "T5", "T6", "L"}  # need the child's health consent, stored encrypted


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
        return {"P14": items, "_hold": [], "_restrictions": []}  # the questionnaire's red flags: the therapist decides
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
        .outerjoin(User, User.id == TherapistAnswer.therapist_id)  # a deleted therapist's answers still count
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
            answers[p] = v
            if not p.startswith("_"):  # the red flags are not parent questions
                by[p] = who
    return answers, by


async def therapist_input(db: AsyncSession, child_id: uuid.UUID, health: bool) -> TherapistInput | None:
    """What the child's therapists set, for the plan engine (plans/safety.py Therapist). The newest T2 and T7 are used;
    the restrictions (T6) and the assigned and excluded exercises (T8) of every therapist count, and an exclusion beats
    an assignment."""
    rows = await _therapist_rows(db, child_id, ["T2", "T6", "T7", "T8"], health)
    if not rows:
        return None
    newest = {q: v for q, v, _ in rows}  # oldest first, so the newest stays
    exclude = {e for q, v, _ in rows if q == "T8" for e in v["exclude"]}
    return TherapistInput(
        restrictions=frozenset(
            r for q, v, _ in rows if q == "T6" for r in v["items"] if r in (*P14_TAGS, "high_intensity")
        ),
        goals=tuple(newest["T7"]["goals"]) if "T7" in newest else (),
        assign=frozenset(e for q, v, _ in rows if q == "T8" for e in v["assign"]) - exclude,
        exclude=frozenset(exclude),
        gmfcs=newest.get("T2"),
    )


async def _round_answers(db: AsyncSession, round_id: uuid.UUID | None) -> dict[str, Any]:
    """A round's answers as the rules read them (the CEO's questionnaire through intake/bridge.py, IQ3)."""
    rows = await db.execute(
        select(IntakeAnswer.question_id, IntakeAnswer.value, IntakeAnswer.secret).where(
            IntakeAnswer.round_id == round_id
        )
    )
    answers = {q: decrypt_json(secret) if secret else value for q, value, secret in rows}
    questionnaire = await db.scalar(select(IntakeRound.questionnaire).where(IntakeRound.id == round_id))
    return rules_view(questionnaire or "p41", answers, datetime.now(TASHKENT).date())


async def _latest_parent_answers(db: AsyncSession, child_id: uuid.UUID) -> dict[str, Any]:
    last = await db.scalar(
        select(IntakeRound.id).where(IntakeRound.child_id == child_id).order_by(IntakeRound.number.desc()).limit(1)
    )
    return await _round_answers(db, last)


async def child_limits(db: AsyncSession, child: Child) -> tuple[frozenset[str], dict[str, dict[str, str]]]:
    """What the child must avoid now, by the plan's own rules: the latest answers with the therapists' put in.
    No answers yet = every cautious restriction (product rule 2). For the assistant (A9.3, B30): the restrictions,
    and the title of each exercise they forbid (a restriction, a surgery's body area, or a therapist took it out)."""
    last = await db.scalar(
        select(IntakeRound.id)
        .where(IntakeRound.child_id == child.id, IntakeRound.completed_at.is_not(None))
        .order_by(IntakeRound.number.desc())
        .limit(1)
    )
    health = await has_consent(db, child.id, ConsentKind.health)
    used, _ = await answers_in_use(db, child.id, await _round_answers(db, last), health)
    therapist = await therapist_input(db, child.id, health)
    today = datetime.now(TASHKENT).date()
    facts = plan_facts(used, birth_date=child.birth_date, start_date=today, health_consent=health, therapist=therapist)
    excluded = therapist.exclude if therapist else frozenset()
    rows = await db.execute(select(Exercise.id, Exercise.title, Exercise.body_area, Exercise.conflicts))
    forbidden = {
        eid: title
        for eid, title, area, conflicts in rows
        if facts.restrictions.intersection(conflicts) or area in facts.surgery or eid in excluded
    }
    return facts.restrictions, forbidden


REBUILDS = {"T2", "T5", "T6", "T7", "T8"}  # restrictions, movement level, goals, exercises


async def rebuild_plan(db: AsyncSession, child_id: uuid.UUID) -> bool:
    """A new plan from the last finished round and what the therapists set now. False when there is no finished
    round yet (the plan then comes when the parent finishes the questions)."""
    last = await db.scalar(
        select(IntakeRound)
        .where(IntakeRound.child_id == child_id, IntakeRound.completed_at.is_not(None))
        .order_by(IntakeRound.number.desc())
        .limit(1)
    )
    child = await db.get(Child, child_id)
    if last is None or child is None:
        return False
    health = await has_consent(db, child_id, ConsentKind.health)
    used, _ = await answers_in_use(db, child_id, await _round_answers(db, last.id), health)
    await create_plan(db, child, last.id, used, health, await therapist_input(db, child_id, health))
    return True


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
    plan_rebuilt: bool = False  # this save changed the child's plan (A8.5)


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
    rebuilt = bool(REBUILDS & clean.keys()) and await rebuild_plan(db, child_id)
    await db.commit()
    return (await _form(db, user, child_id, profession)).model_copy(update={"plan_rebuilt": rebuilt})
