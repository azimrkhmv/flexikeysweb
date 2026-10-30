"""FA2 (founders, 30 Oct 2026): every child aged 2 to 18 gets the plan made from the parent's answers. Age alone never
gives a smaller plan, and never puts a child on the therapist's list; it only picks age-fitting exercises."""

from datetime import date
from typing import Any

import pytest

from app.modules.intake.bridge import p_view
from app.modules.plans.engine import build_plan
from tests.test_plan_engine import LIB

TODAY = date(2026, 10, 30)
SAME = {"B1": ["cp"], "CP2": "one_side", "C10": "ii", "B6": "no", "B8": "no", "CP3": "no", "E7": "no", "E13": "no",
        "E10": "never", "J1": "20", "J9": ["walk", "hold"]}  # fmt: skip


def plan(born: date) -> Any:
    answers = p_view(SAME | {"A2": born.isoformat()}, TODAY)
    return build_plan(answers, LIB, birth_date=born, start_date=TODAY, lang="uz", health_consent=True)


@pytest.mark.parametrize("born", [date(2024, 10, 30), date(2007, 10, 31)], ids=["2 today", "18, 19 tomorrow"])
def test_age_never_limits_the_plan(born: date) -> None:
    seven = plan(date(2019, 5, 1))
    p = plan(born)
    assert p.exercises_allowed and seven.exercises_allowed and all(d.exercises for d in p.days)
    assert [len(d.exercises) for d in p.days] == [len(d.exercises) for d in seven.days]  # a full plan, same size
    assert [len(d.games) for d in p.days] == [len(d.games) for d in seven.days]
    assert p_view(SAME | {"A2": born.isoformat()}, TODAY)["_hold"] == []  # nothing for a therapist to look at first
