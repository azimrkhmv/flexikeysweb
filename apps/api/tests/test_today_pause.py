"""A5.4: pause today; the week view. A paused day moves the plan forward one day and is never counted as missed."""

import uuid
from collections.abc import Iterator
from datetime import date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.main import app
from app.modules.plans.models import Plan
from app.modules.plans.router import TASHKENT, day_dates
from app.modules.today.models import PausedDay
from tests.test_children import API
from tests.test_plan_create import approved_putty  # noqa: F401 (fixture)
from tests.test_plan_read import family_with_plan, move_start
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_day_dates() -> None:
    start = date(2026, 10, 1)
    assert day_dates(start, [])[27] == date(2026, 10, 28)
    dates = day_dates(start, [date(2026, 10, 3)])
    assert dates[:3] == [date(2026, 10, 1), date(2026, 10, 2), date(2026, 10, 4)]
    assert dates[27] == date(2026, 10, 29) and len(dates) == 28  # every plan day is still there, one day later


def get(client: TestClient, who: dict[str, str], child: str, path: str) -> Any:
    return client.get(f"{API}/children/{child}/{path}", headers=who).json()


def tomorrow(client: TestClient, child: str) -> None:
    """Time passes: the plan start and the pauses move one day back, as if it were the next day."""

    async def go(db: Any) -> None:
        moved = (
            update(Plan).where(Plan.child_id == uuid.UUID(child)).values(start_date=Plan.start_date - timedelta(days=1))
        )
        plan_ids = (await db.scalars(moved.returning(Plan.id))).all()
        await db.execute(
            update(PausedDay)
            .where(PausedDay.plan_id.in_(plan_ids))
            .values(paused_on=PausedDay.paused_on - timedelta(days=1))
        )
        await db.commit()

    run(client, go)


def test_a_paused_day_moves_the_plan_and_is_not_missed(client: TestClient, approved_putty: None) -> None:  # noqa: F811
    owner, child = family_with_plan(client)
    move_start(client, child, 2)  # today is plan day 2
    before = get(client, owner, child, "plan")
    today = datetime.now(TASHKENT).date()

    for _ in range(2):  # twice = once
        assert client.post(f"{API}/children/{child}/pause", headers=owner).status_code == 204
    t = get(client, owner, child, "today")
    assert (t["paused"], t["day"], t["exercises"], t["games"]) == (True, 2, [], [])
    plan = get(client, owner, child, "plan")
    assert plan["paused"] == [today.isoformat()]
    assert [d["date"] for d in plan["days"][:3]] == [d["date"] for d in before["days"][:2]] + [
        (today + timedelta(days=1)).isoformat()
    ]
    assert len(plan["days"]) == 28 and plan["days"][27]["date"] == (today + timedelta(days=26)).isoformat()

    tomorrow(client, child)  # the day after the pause brings the plan day that waited
    t = get(client, owner, child, "today")
    assert (t["paused"], t["day"], t["games"]) == (False, 2, before["days"][2]["games"])
    assert get(client, owner, child, "plan")["paused"] == [(today - timedelta(days=1)).isoformat()]


def test_undo_the_pause(client: TestClient) -> None:
    owner, child = family_with_plan(client)
    assert client.post(f"{API}/children/{child}/pause", headers=owner).status_code == 204
    assert client.delete(f"{API}/children/{child}/pause", headers=owner).status_code == 204
    t = get(client, owner, child, "today")
    assert (t["paused"], t["day"]) == (False, 0)
    assert get(client, owner, child, "plan")["paused"] == []


def test_no_pause_outside_the_plan(client: TestClient) -> None:
    owner, child = family_with_plan(client)
    move_start(client, child, -1)  # starts tomorrow
    assert title(client.post(f"{API}/children/{child}/pause", headers=owner)) == (404, "no_task_today")
    move_start(client, child, 28)  # over
    assert title(client.post(f"{API}/children/{child}/pause", headers=owner)) == (404, "no_task_today")


def test_the_plan_shows_what_is_done(client: TestClient, approved_putty: None) -> None:  # noqa: F811
    owner, child = family_with_plan(client)
    day = next(d for d in get(client, owner, child, "plan")["days"] if d["exercises"])
    move_start(client, child, day["day"])
    ex = day["exercises"][0]["exerciseId"]
    mark = client.post(f"{API}/children/{child}/done", headers=owner, json={"day": day["day"], "exerciseId": ex})
    client.patch(f"{API}/children/{child}/done/{mark.json()['id']}", headers=owner, json={"feeling": "ok"})
    item = next(e for e in get(client, owner, child, "today")["exercises"] if e["exerciseId"] == ex)
    assert item["done"] == {"id": mark.json()["id"], "feeling": "ok"}
