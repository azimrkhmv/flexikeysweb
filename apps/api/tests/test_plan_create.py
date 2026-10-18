"""A4.4: finishing a question round builds the plan and stores it with its reasons; the same answers always give
the same plan."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.modules.accounts.models import Role
from app.modules.plans import engine
from app.modules.plans.models import Plan, PlanItem, PlanReason
from tests.test_admin_changes import make
from tests.test_children import API, add_child, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import health_consent, save
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import run
from tests.test_videos_review import decide, new_video


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def approved_putty(client: TestClient) -> None:
    """One exercise with an approved Uzbek video, so plans can hold an exercise."""
    video = new_video(client, "putty_squeeze", "uz")
    _, physio, _ = make(client, Role.physio)
    assert decide(client, physio, video, "approved").status_code == 200


def finished_child(client: TestClient, answers: dict[str, Any], health: bool) -> str:
    owner = parent(client)
    child = add_child(client, owner)
    if health:
        health_consent(client, owner, child)
    assert save(client, owner, child, answers).status_code == 200
    assert finish(client, owner, child).status_code == 200
    return child


def stored(client: TestClient, child: str) -> tuple[Plan, list[tuple[Any, ...]], list[tuple[Any, ...]]]:
    async def go(db: Any) -> Any:
        plan = await db.scalar(select(Plan).where(Plan.child_id == uuid.UUID(child)))
        items = await db.execute(
            select(PlanItem.day, PlanItem.kind, PlanItem.position, PlanItem.ref, PlanItem.level, PlanItem.minutes)
            .where(PlanItem.plan_id == plan.id)
            .order_by(PlanItem.day, PlanItem.kind, PlanItem.position)
        )
        reasons = await db.execute(
            select(PlanReason.slot, PlanReason.goal, PlanReason.ref, PlanReason.level)
            .where(PlanReason.plan_id == plan.id)
            .order_by(PlanReason.position)
        )
        return plan, [tuple(r) for r in items], [tuple(r) for r in reasons]

    return run(client, go)  # type: ignore[no-any-return]


def test_finishing_a_round_builds_and_stores_the_plan(client: TestClient, approved_putty: None) -> None:
    child = finished_child(client, complete(with_health=True), health=True)
    plan, items, reasons = stored(client, child)
    assert (plan.engine_version, plan.exercises_allowed, plan.round_id is not None) == (
        engine.ENGINE_VERSION,
        True,
        True,
    )
    assert {day for day, *_ in items} == set(range(engine.DAYS))
    assert any(kind == "exercise" and ref == "putty_squeeze" for _, kind, _, ref, _, _ in items)
    assert reasons and {slot for slot, *_ in reasons} == {"exercise", "game"}


def test_the_same_answers_always_give_the_same_plan(client: TestClient, approved_putty: None) -> None:
    answers = complete(with_health=True)
    first, second = (stored(client, finished_child(client, answers, health=True)) for _ in range(2))
    assert first[1:] == second[1:]
    assert first[0].start_date == second[0].start_date


def test_without_the_health_consent_the_plan_has_games_only(client: TestClient, approved_putty: None) -> None:
    plan, items, _ = stored(client, finished_child(client, complete(with_health=False), health=False))
    assert plan.exercises_allowed is False
    assert items and all(kind == "game" for _, kind, *_ in items)


def test_an_unfinished_round_makes_no_plan(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, {"P1": "Ali"})
    assert finish(client, owner, child).status_code == 422
    assert run(client, lambda db: db.scalar(select(Plan.id).where(Plan.child_id == uuid.UUID(child)))) is None
    assert client.get(f"{API}/children/{child}/intake", headers=owner).json()[0]["completedAt"] is None
