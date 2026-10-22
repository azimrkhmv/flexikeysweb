# ruff: noqa: F811  (pytest fixtures as arguments)
"""A4.6: the AI chooses the plan, only inside what the rules allow. Whatever the AI answers, a forbidden or unapproved
exercise never gets in; a pick without a source from the given passages is dropped; each AI pick names its research
source; with the AI off (or without a usable pick) the rules plan comes."""

import json
import uuid
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.assistant.ai import FakeAi
from app.modules.plans import engine
from app.modules.plans.models import Plan, PlanReason
from app.modules.plans.safety import LibraryExercise
from app.settings import settings
from tests.test_assistant_chat import ai, client  # noqa: F401
from tests.test_assistant_research import library  # noqa: F401
from tests.test_intake_rounds import complete
from tests.test_plan_create import approved_putty, finished_child, stored  # noqa: F401
from tests.test_videos_register import run

ANSWERS = complete(with_health=True) | {"P33": ["hands"]}


def ex(i: str, area: str = "hands", conflicts: tuple[str, ...] = ()) -> LibraryExercise:
    return LibraryExercise(id=i, body_area=area, goals=("hands",), gmfcs=(1, 2, 3, 4, 5), ages=("2-4", "5-8", "9-12"),
                           tool=None, difficulty=1, conflicts=conflicts, approved=frozenset({"uz"}))  # fmt: skip


def test_the_engine_keeps_only_what_the_rules_allow() -> None:
    lib = [ex("ok_a"), ex("ok_b", "arms"), ex("jumpy", "legs", ("jumping",))]
    choice = engine.Choice(
        exercises=(("jumpy", "KB-1"), ("not_in_library", "KB-1"), ("ok_b", "KB-2")),
        games=(("sort", "KB-1"), ("casino", "KB-1")),
    )
    built = engine.build_plan(
        {"P9": ["cp"], "P12": "walks", "P13": "never", "P14": ["jumping"], "P15": "no", "P17": "no", "P33": ["hands"]},
        lib, birth_date=date(2019, 5, 1), start_date=date(2026, 10, 22), lang="uz", health_consent=True, choice=choice,
    )  # fmt: skip
    used = {e for d in built.days for e, _ in d.exercises}
    assert used == {"ok_b"}  # the jumping one is forbidden for this child, the unknown one is not in the library
    assert {k for d in built.days for k, _ in d.games} == {"sort"}  # only the fixed set of games
    assert built.ai and [(r.ref, r.source) for r in built.reasons] == [("ok_b", "KB-2"), ("sort", "KB-1")]
    rules = engine.build_plan(
        {"P33": ["hands"]}, lib, birth_date=date(2019, 5, 1), start_date=date(2026, 10, 22), lang="uz",
        health_consent=True, choice=engine.Choice(exercises=(("jumpy", "KB-1"),), games=()),
    )  # fmt: skip
    assert not rules.ai and all(r.source is None for r in rules.reasons)  # nothing usable: the rules plan


def choose(*exercises: tuple[str, str], games: tuple[tuple[str, str], ...] = ()) -> str:
    return json.dumps({"exercises": [{"id": i, "source": s} for i, s in exercises],
                       "games": [{"id": k, "source": s} for k, s in games]})  # fmt: skip


def reasons(client: TestClient, child: str) -> list[tuple[str, str | None]]:
    async def go(db: Any) -> Any:
        plan = await db.scalar(select(Plan).where(Plan.child_id == uuid.UUID(child)))
        rows = await db.execute(
            select(PlanReason.ref, PlanReason.source).where(PlanReason.plan_id == plan.id).order_by(PlanReason.position)
        )
        return [tuple(r) for r in rows]

    return run(client, go)  # type: ignore[no-any-return]


@pytest.fixture
def ai_plan(library: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_plan", True)


def test_the_ai_chooses_inside_the_rules_and_names_its_sources(
    ai_plan: None, client: TestClient, ai: FakeAi, approved_putty: None
) -> None:
    ai.replies = [
        '{"entries": ["KB-HAND-01"], "plan": false}',
        choose(("walk_line", "KB-HAND-01"), ("putty_squeeze", "KB-HAND-01"), games=(("trace", "KB-HAND-01"),)),
    ]
    child = finished_child(client, ANSWERS, health=True)
    plan, items, _ = stored(client, child)
    assert plan.engine_version == engine.ENGINE_VERSION + "+ai"
    assert {ref for _, kind, _, ref, *_ in items if kind == "exercise"} == {"putty_squeeze"}  # walk_line: no video
    assert reasons(client, child) == [
        ("putty_squeeze", "KB-HAND-01: Novak et al., 2020; Hoare et al., 2019"),
        ("trace", "KB-HAND-01: Novak et al., 2020; Hoare et al., 2019"),
    ]
    assert "Ali" not in str(ai.sent) and "2019-05-01" not in str(ai.sent)  # never the name or the birth date


@pytest.mark.parametrize(
    "replies",
    [
        ['{"entries": [], "plan": false}'],  # no research passage fits
        ['{"entries": ["KB-HAND-01"]}', choose(("putty_squeeze", "KB-SAFE-01"))],  # a source that was not given
        ['{"entries": ["KB-HAND-01"]}', choose(("putty_squeeze", "my own knowledge"))],
        ['{"entries": ["KB-HAND-01"]}', "Sorry, I cannot help with that."],
    ],
)
def test_without_a_sourced_pick_the_rules_plan_comes(
    replies: list[str], ai_plan: None, client: TestClient, ai: FakeAi, approved_putty: None
) -> None:
    ai.replies = replies
    plan, _, _ = stored(client, finished_child(client, ANSWERS, health=True))
    assert plan.engine_version == engine.ENGINE_VERSION


def test_with_the_ai_off_the_ai_is_not_asked(
    library: None, client: TestClient, ai: FakeAi, approved_putty: None
) -> None:
    plan, _, _ = stored(client, finished_child(client, ANSWERS, health=True))
    assert plan.engine_version == engine.ENGINE_VERSION and ai.sent == []
