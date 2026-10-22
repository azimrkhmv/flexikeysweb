"""The CEO's parent questionnaire of 16 Oct 2026 (IQ1): its questions and which ones a parent is shown.

The questions and display rules R1-R19 are data (app/content/questionnaire.json). This file only reads them; the
website reads the same file with the same logic (apps/web/src/content/questionnaire.ts), and
tests/questionnaire_cases.json proves the two show the same questions for the same child.

An answer of None ("Not sure") or a missing answer never matches a rule, so it never hides a question: the parent
is asked more, not less.
"""

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from app.errors import AppError

DATA: dict[str, Any] = json.loads((Path(__file__).parents[2] / "content" / "questionnaire.json").read_text("utf-8"))
QUESTIONS: dict[str, dict[str, Any]] = {q["id"]: q for q in DATA["questions"]}
DEFS: dict[str, Any] = DATA["defs"]
LEVEL = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5}
VERSION: str = DATA["version"]
NO_NOT_SURE = {"A1", "A2"}  # name and birthday: every other required question may be "Not sure" (spec §5)
TEXT_MAX, LONGTEXT_MAX, FILES_MAX, CLIPS_MAX = 200, 1000, 5, 11  # 11 baseline video tasks (section K)
FILE_KEY = re.compile(r"children/[0-9a-f-]{36}/intake/[0-9a-f-]{36}")
TIME = re.compile(r"([01]\d|2[0-3]):[0-5]\d")

Answers = dict[str, Any]


def _years(born: Any, today: date) -> int | None:
    try:
        b = date.fromisoformat(born)
    except (TypeError, ValueError):
        return None
    return today.year - b.year - ((today.month, today.day) < (b.month, b.day))


def facts(answers: Answers, today: date) -> dict[str, int | None]:
    """Age in years and the GMFCS, MACS and CFCS levels (1-5). A therapist's L2 wins over the parent's C10."""
    return {
        "age": _years(answers.get("A2"), today),
        "gmfcs": LEVEL.get(answers.get("L2") or answers.get("C10")),  # type: ignore[arg-type]
        "macs": LEVEL.get(answers.get("D1")),  # type: ignore[arg-type]
        "cfcs": LEVEL.get(answers.get("G2")),  # type: ignore[arg-type]
    }


def _given(value: Any) -> bool:
    return value is not None and value != "" and value != []


def _in_range(value: Any, cond: dict[str, Any]) -> bool:
    if not isinstance(value, int | float) or isinstance(value, bool):
        return False
    return ("min" not in cond or value >= cond["min"]) and ("max" not in cond or value <= cond["max"])


def holds(cond: dict[str, Any] | None, answers: Answers, f: dict[str, int | None]) -> bool:
    if cond is None:
        return True
    if "ref" in cond:
        return holds(DEFS[cond["ref"]], answers, f)
    if "all" in cond:
        return all(holds(c, answers, f) for c in cond["all"])
    if "any" in cond:
        return any(holds(c, answers, f) for c in cond["any"])
    if "not" in cond:
        return not holds(cond["not"], answers, f)
    if "fact" in cond:
        v = f[cond["fact"]]
        return v in cond["in"] if "in" in cond else _in_range(v, cond)
    v = answers.get(cond["q"])
    if "answered" in cond:
        return _given(v) is bool(cond["answered"])
    if "in" in cond:
        return bool(set(v) & set(cond["in"])) if isinstance(v, list) else v in cond["in"]
    return _in_range(v, cond)


def shown(question_id: str, answers: Answers, today: date) -> bool:
    return holds(QUESTIONS[question_id]["show"], answers, facts(answers, today))


def shown_options(question_id: str, answers: Answers, today: date) -> list[str] | None:
    """The options this parent sees (R8, R11, R15 hide some); None for a question without options."""
    q = QUESTIONS[question_id]
    if q["options"] is None:
        return None
    f, rules = facts(answers, today), q["option_show"] or {}
    return [o for o in q["options"] if holds(rules.get(o), answers, f)]


def visible(answers: Answers, today: date, audience: str = "parent") -> list[str]:
    """Every question this child's parent is asked now, in questionnaire order (sign-up questions left out)."""
    f = facts(answers, today)
    return [
        q["id"]
        for q in DATA["questions"]
        if q["audience"] == audience and not q["signup"] and holds(q["show"], answers, f)
    ]


def _number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def problem_with(q: dict[str, Any], value: Any) -> str | None:
    """Why this value is not a valid answer to q, or None when it is. None = "Not sure" (or clearing an answer)."""
    if value is None:
        return "answer_required" if q["required"] and q["id"] in NO_NOT_SURE else None
    lo, hi = q["range"] or (None, None)
    match q["kind"]:
        case "single":
            return None if isinstance(value, str) and value in q["options"] else "not_an_option"
        case "multi":
            if not isinstance(value, list) or not value or not all(isinstance(v, str) for v in value):
                return "not_a_list"
            if len(set(value)) != len(value) or not set(value) <= set(q["options"]):
                return "not_an_option"
            if q["max"] is not None and len(value) > q["max"]:
                return "too_many"
            return "exclusive_option" if q["exclusive"] in value and len(value) > 1 else None
        case "text" | "longtext":
            if not isinstance(value, str) or not value.strip():
                return "not_text"
            return None if len(value) <= (TEXT_MAX if q["kind"] == "text" else LONGTEXT_MAX) else "too_long"
        case "date":
            try:
                parsed = date.fromisoformat(value)
            except (TypeError, ValueError):
                return "not_a_date"
            return None if date(1990, 1, 1) <= parsed <= date.today() else "not_a_date"
        case "number" | "scale":
            ok = _number(value) and (q["kind"] == "number" or isinstance(value, int)) and lo <= value <= hi
            return None if ok else "out_of_range"
        case "months":  # an age in months (0-20 years), or "not_yet"
            ok = value == "not_yet" or (type(value) is int and 0 <= value <= 240)
            return None if ok else "out_of_range"
        case "time":
            return None if isinstance(value, str) and TIME.fullmatch(value) else "not_a_time"
        case "file":  # files the parent uploaded (intake/router.py file_link); the router checks they are this child's
            ok = (
                isinstance(value, list)
                and len(value) <= FILES_MAX
                and all(isinstance(v, str) and FILE_KEY.fullmatch(v) for v in value)
            )
            return None if ok else "not_files"
        case "media":  # the baseline video clips (section K)
            ok = isinstance(value, list) and len(value) <= CLIPS_MAX and all(isinstance(v, str) for v in value)
            return None if ok else "not_clips"
    return "unknown_kind"


def check_answer(question_id: str, value: Any) -> dict[str, Any]:
    """The question, if the answer is valid; otherwise 422 invalid_answer saying which question and why. Only the
    parent's questions: the therapist's section L has its own form (IQ6)."""
    q = QUESTIONS.get(question_id)
    if q is None or q["audience"] != "parent":
        raise AppError(422, "invalid_answer", question=question_id, reason="unknown_question")
    if reason := problem_with(q, value):
        raise AppError(422, "invalid_answer", question=question_id, reason=reason)
    return q


def missing_answers(answers: Answers, health_consent: bool, today: date) -> list[str]:
    """Required questions this child's parent is shown and has not answered ("Not sure" counts as answered).
    Without the health consent the health questions are not asked, as on the website."""
    return [
        qid
        for qid in visible(answers, today)
        if QUESTIONS[qid]["required"] and (health_consent or not QUESTIONS[qid]["health"]) and qid not in answers
    ]
