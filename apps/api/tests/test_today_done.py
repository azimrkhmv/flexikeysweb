"""A5.3: Done with easy / OK / hard. Two "hard" lower the level, two "easy" raise it, unless a therapist fixed it."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.plans.engine import level_after
from app.modules.plans.models import FixedLevel
from tests.test_children import API, add_helper, parent
from tests.test_plan_create import approved_putty  # noqa: F401 (fixture)
from tests.test_plan_read import family_with_plan, move_start
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_level_rule_matches_the_website() -> None:  # the same cases as roadmap.test.ts
    assert level_after(2, ["hard", "hard"]) == 1
    assert level_after(2, ["easy", "easy"]) == 3
    assert level_after(2, ["hard", "ok", "hard"]) == 2
    assert level_after(2, ["hard", None, "hard"]) == 1
    assert level_after(2, ["hard", "easy", "hard"]) == 2
    assert level_after(1, ["hard", "hard"]) == 1
    assert level_after(3, ["easy", "easy", "easy"]) == 3
    assert level_after(1, ["easy", "easy", "easy"]) == 2
    assert level_after(1, ["easy", "easy", "easy", "easy"]) == 3


def putty_days(client: TestClient, who: dict[str, str], child: str) -> list[int]:
    plan = client.get(f"{API}/children/{child}/plan", headers=who).json()
    return [d["day"] for d in plan["days"] if any(e["exerciseId"] == "putty_squeeze" for e in d["exercises"])]


def done(client: TestClient, who: dict[str, str], child: str, day: int) -> Any:
    return client.post(f"{API}/children/{child}/done", headers=who, json={"day": day, "exerciseId": "putty_squeeze"})


def rate(client: TestClient, who: dict[str, str], child: str, done_id: str, feeling: str) -> Any:
    return client.patch(f"{API}/children/{child}/done/{done_id}", headers=who, json={"feeling": feeling})


def today_level(client: TestClient, who: dict[str, str], child: str) -> int:
    plan = client.get(f"{API}/children/{child}/plan", headers=who).json()
    return int(next(e["level"] for d in plan["days"] for e in d["exercises"] if e["exerciseId"] == "putty_squeeze"))


@pytest.fixture
def family(client: TestClient, approved_putty: None) -> tuple[dict[str, str], str, list[int]]:  # noqa: F811
    owner, child = family_with_plan(client)
    days = putty_days(client, owner, child)
    assert len(days) >= 3
    move_start(client, child, days[2])  # the first three putty days are today or before
    return owner, child, days


def test_one_tap_done_twice_is_once(client: TestClient, family: Any) -> None:
    owner, child, days = family
    first = done(client, owner, child, days[0])
    assert first.status_code == 201, first.text
    body = first.json()
    assert (body["day"], body["exerciseId"], body["feeling"], body["level"]) == (days[0], "putty_squeeze", None, 1)
    again = done(client, owner, child, days[0])
    assert (again.status_code, again.json()["id"]) == (200, body["id"])


def test_easy_twice_raises_hard_twice_lowers(client: TestClient, family: Any) -> None:
    owner, child, days = family
    helper = add_helper(client, owner)  # any adult of the family may mark done
    a = done(client, owner, child, days[0]).json()["id"]
    b = done(client, helper, child, days[1]).json()["id"]
    c = done(client, owner, child, days[2]).json()["id"]
    assert rate(client, owner, child, a, "easy").json()["level"] == 1  # one is not enough
    assert rate(client, helper, child, b, "easy").json()["level"] == 2
    assert today_level(client, owner, child) == 2  # the plan shows the new level
    assert rate(client, owner, child, c, "hard").json()["level"] == 2
    assert rate(client, owner, child, b, "hard").json()["level"] == 1  # changed: easy, hard, hard
    assert title(rate(client, owner, child, a, "great")) == (422, "validation_error")


def test_a_therapist_fixed_level_does_not_move(client: TestClient, family: Any) -> None:
    owner, child, days = family

    async def fix(db: Any) -> None:
        db.add(FixedLevel(child_id=uuid.UUID(child), exercise_id="putty_squeeze", level=3))
        await db.commit()

    run(client, fix)
    ids = [done(client, owner, child, d).json()["id"] for d in days[:2]]
    for i in ids:
        assert rate(client, owner, child, i, "hard").json()["level"] == 3
    assert today_level(client, owner, child) == 3


def test_not_a_day_still_to_come_nor_another_family(client: TestClient, family: Any) -> None:
    owner, child, days = family
    assert title(done(client, owner, child, days[3])) == (409, "not_yet")
    assert title(done(client, owner, child, 99)) == (404, "not_found")
    stranger = parent(client)
    assert title(done(client, stranger, child, days[0])) == (404, "not_found")
    mine = done(client, owner, child, days[0]).json()["id"]
    assert title(rate(client, stranger, child, mine, "easy")) == (404, "not_found")
