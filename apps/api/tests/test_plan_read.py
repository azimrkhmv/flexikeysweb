"""A4.5: the current plan and today's task, readable by every member of the family and by nobody else."""

import uuid
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.main import app
from app.modules.plans.models import Plan
from app.modules.plans.router import TASHKENT
from tests.test_children import API, add_child, add_helper, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import health_consent, save
from tests.test_plan_create import approved_putty  # noqa: F401 (fixture)
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def family_with_plan(client: TestClient) -> tuple[dict[str, str], str]:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    save(client, owner, child, complete(with_health=True))
    assert finish(client, owner, child).status_code == 200
    return owner, child


def move_start(client: TestClient, child: str, days_ago: int) -> None:
    async def go(db: Any) -> None:
        start = datetime.now(TASHKENT).date() - timedelta(days=days_ago)
        await db.execute(update(Plan).where(Plan.child_id == uuid.UUID(child)).values(start_date=start))
        await db.commit()

    run(client, go)


def test_owner_and_helper_read_the_plan_and_today(client: TestClient, approved_putty: None) -> None:  # noqa: F811
    owner, child = family_with_plan(client)
    helper = add_helper(client, owner)
    for who in (owner, helper):
        plan = client.get(f"{API}/children/{child}/plan", headers=who).json()
        assert len(plan["days"]) == 28 and plan["exercisesAllowed"] is True and plan["reasons"]
        today = client.get(f"{API}/children/{child}/today", headers=who).json()
        assert today == {**plan["days"][0], "paused": False}
    putty = [e for d in plan["days"] for e in d["exercises"] if e["exerciseId"] == "putty_squeeze"]
    assert putty and (putty[0]["title"]["en"], putty[0]["tool"]) == ("Squeeze the putty", "putty")


def test_today_follows_the_calendar(client: TestClient) -> None:
    owner, child = family_with_plan(client)
    plan = client.get(f"{API}/children/{child}/plan", headers=owner).json()
    move_start(client, child, 3)
    assert client.get(f"{API}/children/{child}/today", headers=owner).json()["games"] == plan["days"][3]["games"]
    move_start(client, child, 28)
    assert title(client.get(f"{API}/children/{child}/today", headers=owner)) == (404, "no_task_today")
    move_start(client, child, -1)  # starts tomorrow
    assert title(client.get(f"{API}/children/{child}/today", headers=owner)) == (404, "no_task_today")


def test_no_plan_before_the_first_round_is_finished(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    for path in ("plan", "today"):
        assert title(client.get(f"{API}/children/{child}/{path}", headers=owner)) == (404, "no_plan")


def test_nobody_outside_the_family_reads_it(client: TestClient) -> None:
    _, child = family_with_plan(client)
    stranger = parent(client)
    for path in ("plan", "today"):
        assert title(client.get(f"{API}/children/{child}/{path}", headers=stranger)) == (404, "not_found")
