"""A6.7: game choice and game sessions; the server enforces the 20-minute limit and "one new game a week"."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.main import app
from app.modules.play.models import GamePlayed, GameSession
from tests.test_children import API, add_child, parent
from tests.test_play_tries import a_try, send
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def started_ago(client: TestClient, session: str, minutes: int) -> None:
    async def go(db: Any) -> None:
        when = datetime.now(UTC) - timedelta(minutes=minutes)
        await db.execute(update(GameSession).where(GameSession.id == uuid.UUID(session)).values(created_at=when))
        await db.commit()

    run(client, go)


def kinds(client: TestClient, who: dict[str, str], child: str) -> set[str]:
    slots = client.get(f"{API}/children/{child}/games", headers=who).json()["slots"]
    choice = next(s for s in slots if s["slot"] == "choice")
    return {g["kind"] for g in choice["games"]}


def test_twenty_minutes_a_day(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    s = client.post(f"{API}/children/{child}/game-sessions", headers=owner).json()
    assert (s["secondsPlayed"], s["secondsLeftToday"]) == (0, 1200)
    url = f"{API}/children/{child}/game-sessions/{s['id']}"
    assert client.patch(url, headers=owner, json={"secondsPlayed": 1200}).json()["secondsPlayed"] <= 120  # not faked
    started_ago(client, s["id"], 30)
    assert client.patch(url, headers=owner, json={"secondsPlayed": 1200}).json()["secondsLeftToday"] == 0
    assert client.patch(url, headers=owner, json={"secondsPlayed": 5}).json()["secondsPlayed"] == 1200  # never back
    assert title(client.post(f"{API}/children/{child}/game-sessions", headers=owner)) == (409, "daily_limit")
    assert client.get(f"{API}/children/{child}/games", headers=owner).json() == {"secondsLeftToday": 0, "slots": []}


def test_three_slots_and_one_new_game_a_week(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    slots = client.get(f"{API}/children/{child}/games", headers=owner).json()["slots"]
    assert [s["slot"] for s in slots] == ["easy_win", "growth", "choice"]
    first = kinds(client, owner, child)
    assert len(first) == 1  # nothing played yet: one new kind
    (kind,) = first
    send(client, owner, child, [a_try(game=kind, level=1)])
    assert kinds(client, owner, child) == first  # this week's new game is still new: no second one

    async def week_later(db: Any) -> None:
        await db.execute(
            update(GamePlayed)
            .where(GamePlayed.child_id == uuid.UUID(child))
            .values(first_played=datetime.now(UTC).date() - timedelta(days=8))
        )
        await db.commit()

    run(client, week_later)
    later = kinds(client, owner, child)
    assert kind in later and len(later) == 2  # one more, and the played one stays


def steps(client: TestClient, who: dict[str, str], child: str) -> set[tuple[str, int]]:
    """The skill-game kinds and tiers in today's choice."""
    slots = client.get(f"{API}/children/{child}/games", headers=who).json()["slots"]
    choice = next(s for s in slots if s["slot"] == "choice")
    return {(g["kind"], g["tier"]) for g in choice["games"] if g["level"] == 0}


def test_tiers_open_by_success_and_seed_is_free(client: TestClient) -> None:
    """B83 (games spec §3.2-3.3): Seed of every area is open from the start; Sprout opens after 20 clean tries with
    85% success on Seed's last step, and is played with Pro only. An opened tier never closes."""
    owner = parent(client)
    child = add_child(client, owner)

    def tops() -> dict[str, int]:
        return {s["area"]: s["topTier"] for s in client.get(f"{API}/children/{child}/skills", headers=owner).json()}

    assert set(tops().values()) == {1}
    send(client, owner, child, [a_try(game="find_same", level=0, tier=1, step=3, accessEvent=True, outcome="skipped")])
    send(client, owner, child, [a_try(game="find_same", level=0, tier=4, step=3) for _ in range(19)])
    assert {t for k, t in steps(client, owner, child) if k == "find_same"} == {1}  # Seed is in today's choice
    assert tops()["attention"] == 1  # 19 clean tries (the access event does not count): not yet
    send(client, owner, child, [a_try(game="scene", level=0, tier=4, step=3)])  # the 20th clean attention try
    assert (tops()["attention"], tops()["memory"]) == (2, 1)
    assert ("find_same", 2) not in steps(client, owner, child)  # Sprout is Pro
    assert client.post(f"{API}/family/trial", headers=owner).status_code == 200
    assert ("find_same", 2) in steps(client, owner, child) and ("find_same", 3) not in steps(client, owner, child)
    send(client, owner, child, [a_try(game="find_same", level=0, tier=1, step=1, outcome="wrong") for _ in range(30)])
    assert tops()["attention"] == 2  # an opened tier never closes


def test_only_the_family(client: TestClient) -> None:
    child = add_child(client, parent(client))
    assert title(client.get(f"{API}/children/{child}/games", headers=parent(client))) == (404, "not_found")
