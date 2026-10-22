"""The CEO's parent questionnaire of 16 Oct 2026 (IQ1): its questions and which ones a parent is shown.

The questions and display rules R1-R19 are data (app/content/questionnaire.json). This file only reads them; the
website reads the same file with the same logic (apps/web/src/content/questionnaire.ts), and
tests/questionnaire_cases.json proves the two show the same questions for the same child.

An answer of None ("Not sure") or a missing answer never matches a rule, so it never hides a question: the parent
is asked more, not less.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any

DATA: dict[str, Any] = json.loads((Path(__file__).parents[2] / "content" / "questionnaire.json").read_text("utf-8"))
QUESTIONS: dict[str, dict[str, Any]] = {q["id"]: q for q in DATA["questions"]}
DEFS: dict[str, Any] = DATA["defs"]
LEVEL = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5}

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
