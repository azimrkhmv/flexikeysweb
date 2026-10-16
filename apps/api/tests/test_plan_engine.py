"""A4.3: the server's plan is exactly the website's plan, for all 284 cases in roadmap_cases.json.

roadmap_cases.json is a copy of apps/web/src/content/backend/roadmap_cases.json (made by backend-content.test.ts):
the library the website used, each input, and the sha256 of the plan the website built from it.
"""

import hashlib
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.modules.plans.engine import DAYS, build_plan
from app.modules.plans.safety import LibraryExercise, Therapist

DATA = json.loads((Path(__file__).parent / "roadmap_cases.json").read_text("utf-8"))
LIB = [
    LibraryExercise(
        id=v["id"],
        body_area=v["bodyArea"],
        goals=tuple(v["goals"]),
        gmfcs=tuple(v["gmfcs"]),
        ages=tuple(v["ages"]),
        tool=v.get("tool"),
        difficulty=v["difficulty"],
        conflicts=tuple(v["conflicts"]),
        approved=frozenset(lang for lang, ver in v["versions"].items() if ver["status"] == "approved"),
    )
    for v in DATA["library"]
]


def plan_json(i: dict[str, Any]) -> str:
    """The plan in the website's field names and key order (backend-content.test.ts canon), as compact JSON."""
    th = i.get("therapist")
    therapist = th and Therapist(
        restrictions=frozenset(th["restrictions"]),
        goals=tuple(th["goals"]),
        assign=frozenset(th["assign"]),
        exclude=frozenset(th["exclude"]),
        leg_balance_approved=th["legBalanceApproved"],
        gmfcs=th.get("gmfcs"),
    )
    plan = build_plan(
        i["answers"],
        LIB,
        birth_date=date.fromisoformat(i["birthDate"]),
        start_date=date.fromisoformat(i["startDate"]),
        lang=i["lang"],
        health_consent=i["healthConsent"],
        therapist=therapist,
        **({"tools": i["tools"]} if "tools" in i else {}),
    )
    out = {
        "child_id": i["childId"],
        "round": i["round"],
        "start_date": i["startDate"],
        "days": [
            {
                "date": d.date.isoformat(),
                "exercises": [{"video_id": ref, "level": level} for ref, level in d.exercises],
                "games": [{"kind": kind, "minutes": minutes} for kind, minutes in d.games],
            }
            for d in plan.days
        ],
        "reasons": [{"slot": r.slot, "goal": r.goal, "ref": r.ref, "level": r.level} for r in plan.reasons],
        "exercises_allowed": plan.exercises_allowed,
    }
    return json.dumps(out, separators=(",", ":"), ensure_ascii=False)


def test_all_cases_are_here() -> None:
    assert len(DATA["cases"]) == 284


@pytest.mark.parametrize("case", DATA["cases"], ids=lambda c: hashlib.sha256(str(c["input"]).encode()).hexdigest()[:8])
def test_same_plan_as_the_website(case: dict[str, Any]) -> None:
    got = plan_json(case["input"])
    if "expected" in case:  # the first few keep the whole plan, so a difference is readable
        assert json.loads(got) == case["expected"]
    assert hashlib.sha256(got.encode()).hexdigest() == case["sha256"]


def test_shape() -> None:
    first = DATA["cases"][0]["input"]
    plan = json.loads(plan_json(first))
    assert len(plan["days"]) == DAYS
    assert all(sum(g["minutes"] for g in d["games"]) <= 20 for d in plan["days"])
