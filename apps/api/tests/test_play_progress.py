"""B89 (games spec §8): the progress panel. A level 1-100 per shown area after 10 clean tries, the last 8 weeks, what
the child can do now and 4 weeks ago; for a therapist also the tries, access events and open tier."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.play import skill
from app.modules.play.models import SkillArea, SkillSnapshot
from tests.test_children import API, add_child, parent
from tests.test_play_tries import a_try, send
from tests.test_therapists import new_phone, shared_child, sign_in
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def areas(got: Any) -> dict[str, dict[str, Any]]:
    assert got.status_code == 200, got.text
    return {a["area"]: a for a in got.json()["areas"]}


def test_levels_weeks_and_can_do(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    progress = areas(client.get(f"{API}/children/{child}/progress", headers=owner))
    # Access is never shown; Speed only while open (no play check yet here).
    assert list(progress) == ["attention", "memory", "flexibility", "reasoning", "literacy", "numeracy"]
    for a in progress.values():
        assert (a["level"], a["best"], a["now"], a["before"], a["topTier"]) == (None, None, None, None, 1)
        assert len(a["weeks"]) == 8 and all(w["level"] is None for w in a["weeks"])
    week = skill.week_start(datetime.now(UTC))
    assert progress["attention"]["weeks"][-1]["weekStart"] == week.isoformat()
    assert progress["attention"]["weeks"][0]["weekStart"] == (week - timedelta(weeks=7)).isoformat()

    step = {"game": "find_same", "level": 0, "tier": 1, "step": 1}
    send(client, owner, child, [a_try(**step) for _ in range(9)])
    attention = areas(client.get(f"{API}/children/{child}/progress", headers=owner))["attention"]
    assert attention["level"] is None  # 9 clean tries: "Not enough games yet"
    assert attention["now"] == {"activityId": "find_same-skill", "tier": 1, "step": 1}  # 3 right in 14 days

    send(client, owner, child, [a_try(**step), a_try(**step, accessEvent=True, outcome="skipped")])
    attention = areas(client.get(f"{API}/children/{child}/progress", headers=owner))["attention"]
    theta = {s["area"]: s for s in client.get(f"{API}/children/{child}/skills", headers=owner).json()}["attention"]
    assert theta["nTrials"] == 10  # the access event is left out (rule 5)
    assert attention["level"] == skill.skill_level(theta["theta"]) == attention["weeks"][-1]["level"]
    assert attention["best"] == attention["level"]
    assert attention["before"] is None

    # A snapshot of 5 weeks ago: the line carries it forward until the next one; "4 weeks ago" is its step.
    async def old(db: Any) -> None:
        db.add(
            SkillSnapshot(
                child_id=uuid.UUID(child), area=SkillArea.attention, week_start=week - timedelta(weeks=5),
                theta=2.5, n_trials=40, top_activity_id="scene-skill", top_tier=2, top_step=3,
            )
        )  # fmt: skip
        await db.commit()

    run(client, old)
    attention = areas(client.get(f"{API}/children/{child}/progress", headers=owner))["attention"]
    high = skill.skill_level(2.5)
    assert [w["level"] for w in attention["weeks"]] == [None, None, high, high, high, high, high, attention["level"]]
    assert attention["before"] == {"activityId": "scene-skill", "tier": 2, "step": 3}
    assert attention["best"] == high > attention["level"]  # the tree never shrinks


def test_the_therapist_sees_tries_access_events_and_tier_and_nobody_else_sees_it(client: TestClient) -> None:
    owner, child = shared_child(client)
    phone = new_phone()
    link = client.post(f"{API}/children/{child}/therapists", headers=owner, json={"phone": phone}).json()
    therapist, _ = sign_in(client, phone)
    assert title(client.get(f"{API}/therapist/children/{child}/progress", headers=therapist)) == (404, "not_found")
    client.post(f"{API}/therapist/invites/{link['id']}/accept", headers=therapist)

    step = {"game": "card_pairs", "level": 0, "tier": 1, "step": 2}
    old = (datetime.now(UTC) - timedelta(days=40)).isoformat()
    send(client, owner, child, [a_try(**step) for _ in range(4)] + [a_try(**step, ts=old)])
    send(client, owner, child, [a_try(**step, accessEvent=True, outcome="skipped") for _ in range(2)])
    memory = areas(client.get(f"{API}/therapist/children/{child}/progress", headers=therapist))["memory"]
    assert (memory["tries"], memory["accessEvents"], memory["topTier"]) == (6, 2, 1)  # the last 4 weeks only
    assert memory["now"] == {"activityId": "card_pairs-skill", "tier": 1, "step": 2}
    family = areas(client.get(f"{API}/children/{child}/progress", headers=owner))["memory"]
    assert "tries" not in family and "accessEvents" not in family
    assert {k: v for k, v in memory.items() if k not in ("tries", "accessEvents")} == family

    # A share opens the therapist address only; strangers get "not found".
    assert title(client.get(f"{API}/children/{child}/progress", headers=therapist)) == (404, "not_found")
    assert title(client.get(f"{API}/children/{child}/progress", headers=parent(client))) == (404, "not_found")
    other = parent(client)
    assert title(client.get(f"{API}/therapist/children/{child}/progress", headers=other)) == (404, "not_found")


def test_speed_shows_only_while_open(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    star = {"game": "tap_star", "level": 0, "tier": 1, "step": 1}
    send(client, owner, child, [a_try(**star, responseMs=900) for _ in range(30)])
    assert "speed" not in areas(client.get(f"{API}/children/{child}/progress", headers=owner))
    access = {"minTargetMm": 20, "dwellMs": 800, "repeatLock": False, "releaseOk": True, "inputMode": "touch"}
    client.put(f"{API}/children/{child}/access", headers=owner, json=access)
    speed = areas(client.get(f"{API}/children/{child}/progress", headers=owner))["speed"]
    assert speed["level"] is not None and speed["now"] == {"activityId": "tap_star-skill", "tier": 1, "step": 1}
    # Right but late (after the window) does not count towards "can do now".
    late = {"game": "quick_snap", "level": 0, "tier": 2, "step": 1, "responseMs": 2500}
    send(client, owner, child, [a_try(**late) for _ in range(3)])
    speed = areas(client.get(f"{API}/children/{child}/progress", headers=owner))["speed"]
    assert speed["now"] == {"activityId": "tap_star-skill", "tier": 1, "step": 1}
