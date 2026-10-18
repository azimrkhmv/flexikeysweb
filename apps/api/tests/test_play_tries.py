"""A6.5: play check runs; batches of tries; access events never change a skill level."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import app
from app.modules.play.models import SkillLevel, Try
from tests.test_children import API, add_child, parent
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def a_try(**over: Any) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()), "ts": datetime.now(UTC).isoformat(), "sessionId": "local-1", "game": "find_same",
        "level": 3, "itemId": "fruits_1", "inputMode": "touch", "outcome": "correct", "attempts": 1,
        "hintShown": "none", "accessEvent": False, "helpedByAdult": False, "responseMs": 2100, **over,
    }  # fmt: skip


def send(client: TestClient, who: dict[str, str], child: str, batch: list[dict[str, Any]]) -> Any:
    return client.post(f"{API}/children/{child}/tries", headers=who, json=batch)


def stored(client: TestClient, child: str) -> tuple[int, dict[str, tuple[float, int]]]:
    async def go(db: Any) -> tuple[int, dict[str, tuple[float, int]]]:
        n = await db.scalar(select(func.count()).select_from(Try).where(Try.child_id == uuid.UUID(child)))
        skills = await db.scalars(select(SkillLevel).where(SkillLevel.child_id == uuid.UUID(child)))
        return n, {s.area.value: (s.theta, s.n_trials) for s in skills}

    return run(client, go)  # type: ignore[no-any-return]


def test_a_batch_sent_twice_is_stored_once(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    batch = [a_try(), a_try(outcome="wrong", attempts=1), a_try(attempts=2)]
    assert send(client, owner, child, batch).json() == {"stored": 3}
    assert send(client, owner, child, batch).json() == {"stored": 0}  # the retry
    n, skills = stored(client, child)
    assert n == 3 and skills["attention"][1] == 3  # find_same trains attention; three clean tries


def test_access_events_never_change_a_skill_level(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    send(client, owner, child, [a_try()])
    before = stored(client, child)[1]
    slips = [a_try(accessEvent=True, outcome="skipped", attempts=k) for k in range(1, 6)]
    assert send(client, owner, child, slips).json() == {"stored": 5}  # kept as records
    n, after = stored(client, child)
    assert n == 6 and after == before  # but the skill level is untouched


def test_a_right_answer_raises_a_wrong_one_lowers(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    send(client, owner, child, [a_try(game="missing")])
    up = stored(client, child)[1]["memory"][0]
    assert up > 0
    send(client, owner, child, [a_try(game="missing", outcome="wrong")])
    assert stored(client, child)[1]["memory"][0] < up


def test_old_tries_are_not_kept_and_strangers_cannot_send(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    old = a_try(ts=(datetime.now(UTC) - timedelta(days=91)).isoformat())
    assert send(client, owner, child, [old]).json() == {"stored": 0}
    assert title(send(client, parent(client), child, [a_try()])) == (404, "not_found")
    assert title(send(client, owner, child, [a_try(outcome="oops")])) == (422, "validation_error")


def test_play_check_runs(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert title(client.get(f"{API}/children/{child}/play-check", headers=owner)) == (404, "no_play_check")
    run_ = client.post(f"{API}/children/{child}/play-check", headers=owner).json()
    assert (run_["status"], run_["stage"], run_["helpedByAdult"]) == ("open", 1, False)
    url = f"{API}/children/{child}/play-check/{run_['id']}"
    assert client.patch(url, headers=owner, json={"stage": 2, "helpedByAdult": True}).json()["stage"] == 2
    done = client.patch(url, headers=owner, json={"status": "stopped"}).json()
    assert done["status"] == "stopped" and done["finishedAt"]
    assert title(client.patch(url, headers=owner, json={"stage": 1})) == (409, "play_check_closed")
    again = client.post(f"{API}/children/{child}/play-check", headers=owner).json()  # a retry
    assert client.get(f"{API}/children/{child}/play-check", headers=owner).json()["id"] == again["id"]
