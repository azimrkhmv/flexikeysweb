"""The parent intake questions (P1-P41) and what counts as a valid answer.

The questions come from the website (apps/web/src/content/backend/intake.json, made from content/intake.ts),
so the server and the website can never disagree. A test fails when the two copies differ.

Answer values (apps/web/src/lib/types.ts IntakeValue):
- None means "Not sure" (spec §5): allowed for required questions except P1, P2 and the ability scales,
  and for any optional question (it clears the answer);
- single: one option; multi: a list of options (`max` picks at most, the `exclusive` option only on its own);
- ability: 0, 1 or 2; date: "YYYY-MM-DD"; text: up to 200 characters; longtext: up to 1000;
- media: up to 3 clip ids (P40); phone: an Uzbek mobile number.
"""

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from app.errors import AppError
from app.modules.auth.router import normalize_phone

NO_NOT_SURE = {"P1", "P2"}  # apps/web/src/content/intake.ts NO_NOT_SURE
TEXT_MAX, LONGTEXT_MAX, MEDIA_MAX = 200, 1000, 3  # Fields.tsx maxLength=200, P39_MAX, P40_MAX_CLIPS

Value = str | list[str] | int | None


@dataclass(frozen=True)
class Question:
    id: str
    kind: str
    options: tuple[str, ...] | None
    required: bool
    max: int | None
    exclusive: str | None
    show_if: tuple[str, str] | None  # shown only when this other question has this answer
    step: str
    health: bool  # a health answer: needs the child's health consent, stored encrypted (A2.4, A2.5)

    @property
    def allows_not_sure(self) -> bool:
        return not self.required or (self.id not in NO_NOT_SURE and self.kind != "ability")


def _load() -> dict[str, Question]:
    raw = json.loads((Path(__file__).parents[2] / "content" / "intake.json").read_text("utf-8"))
    return {
        q["id"]: Question(
            id=q["id"],
            kind=q["kind"],
            options=tuple(q["options"]) if q["options"] else None,
            required=q["required"],
            max=q["max"],
            exclusive=q["exclusive"],
            show_if=(q["show_if"][0], q["show_if"][1]) if q["show_if"] else None,
            step=q["step"],
            health=q["health"],
        )
        for q in raw
    }


QUESTIONS: dict[str, Question] = _load()


def problem_with(q: Question, value: Any) -> str | None:
    """Why this value is not a valid answer to q, or None when it is."""
    if value is None:
        return None if q.allows_not_sure else "answer_required"
    match q.kind:
        case "single":
            ok = isinstance(value, str) and value in (q.options or ())
            return None if ok else "not_an_option"
        case "multi":
            if not isinstance(value, list) or not value or not all(isinstance(v, str) for v in value):
                return "not_a_list"
            if len(set(value)) != len(value) or not set(value) <= set(q.options or ()):
                return "not_an_option"
            if q.max is not None and len(value) > q.max:
                return "too_many"
            if q.exclusive in value and len(value) > 1:
                return "exclusive_option"
            return None
        case "ability":
            ok = type(value) is int and value in (0, 1, 2)
            return None if ok else "not_an_option"
        case "date":
            try:
                parsed = date.fromisoformat(value)
            except (TypeError, ValueError):
                return "not_a_date"
            return None if date(1990, 1, 1) <= parsed <= date.today() else "not_a_date"
        case "text" | "longtext":
            limit = TEXT_MAX if q.kind == "text" else LONGTEXT_MAX
            if not isinstance(value, str) or not value.strip():
                return "not_text"
            return None if len(value) <= limit else "too_long"
        case "media":
            ok = isinstance(value, list) and len(value) <= MEDIA_MAX and all(isinstance(v, str) for v in value)
            return None if ok else "not_clips"
        case "phone":
            return None if isinstance(value, str) and normalize_phone(value) else "invalid_phone"
    return "unknown_kind"


def check_answer(question_id: str, value: Any) -> Question:
    """The question, if the answer is valid; otherwise 422 invalid_answer saying which question and why."""
    q = QUESTIONS.get(question_id)
    if q is None:
        raise AppError(422, "invalid_answer", question=question_id, reason="unknown_question")
    if reason := problem_with(q, value):
        raise AppError(422, "invalid_answer", question=question_id, reason=reason)
    return q


def is_shown(q: Question, answers: dict[str, Value]) -> bool:
    """A follow-up question applies only when its parent answer matches (intake.ts `has`)."""
    if q.show_if is None:
        return True
    parent, wanted = q.show_if
    given = answers.get(parent)
    return wanted in given if isinstance(given, list) else given == wanted
