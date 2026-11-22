"""B115 (Update 4 spec 6): in live mode an exercise reaches a parent only once a specialist signed it off (its video
approved by a physiotherapist, product rule 3): never through the plan, the exercise list or the video address."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.modules.accounts.models import Role
from app.modules.plans.models import Plan, PlanItem
from app.modules.videos.models import Exercise, Video, servable
from tests.test_admin_changes import make
from tests.test_children import API, add_child, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import health_consent, save
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import run, title
from tests.test_videos_review import decide, new_video


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def refs(data: Any) -> set[str]:
    """Every exercise id named anywhere in a response."""
    found: set[str] = set()
    if isinstance(data, dict):
        for k, v in data.items():
            if k in {"ref", "exerciseId", "videoId"} and isinstance(v, str):
                found.add(v)
            found |= refs(v)
    elif isinstance(data, list):
        for v in data:
            found |= refs(v)
    return found


def unapproved(client: TestClient, lang: str) -> set[str]:
    async def go(db: Any) -> set[str]:
        every = set(await db.scalars(select(Exercise.id).where(Exercise.active)))
        ok = set(await db.scalars(select(Video.exercise_id).where(servable(), Video.lang == lang)))
        return every - ok

    return run(client, go)  # type: ignore[no-any-return]


def test_an_unapproved_exercise_never_reaches_a_parent(client: TestClient) -> None:
    _, physio, _ = make(client, Role.physio)
    good = new_video(client, "putty_squeeze", "uz")
    assert decide(client, physio, good, "approved").status_code == 200
    waiting = new_video(client, "finger_walk", "uz")  # sent for review, not signed off
    assert decide(client, physio, waiting, "changes_requested", "Not yet").status_code == 200

    owner = parent(client)
    child = add_child(client, owner)  # learns Uzbek
    health_consent(client, owner, child)
    assert save(client, owner, child, complete(with_health=True)).status_code == 200
    assert finish(client, owner, child).status_code == 200

    hidden = unapproved(client, "uz")
    assert "finger_walk" in hidden and "putty_squeeze" not in hidden

    # The plan as stored, and as the parent reads it.
    async def items(db: Any) -> set[str]:
        plan = await db.scalar(select(Plan).where(Plan.child_id == uuid.UUID(child)))
        return set(
            await db.scalars(select(PlanItem.ref).where(PlanItem.plan_id == plan.id, PlanItem.kind == "exercise"))
        )

    stored = run(client, items)
    assert stored and "putty_squeeze" in stored  # the check below is not empty
    assert not stored & hidden
    for path in (f"/children/{child}/plan", f"/children/{child}/today", f"/children/{child}/videos"):
        r = client.get(f"{API}{path}", headers=owner)
        if r.status_code == 200:
            assert not refs(r.json()) & hidden, path

    # The exercise list and the video address.
    listed = {v["exerciseId"] for v in client.get(f"{API}/videos", headers=owner).json() if "uz" in v["langs"]}
    assert "putty_squeeze" in listed and not listed & hidden
    assert title(client.get(f"{API}/videos/finger_walk", headers=owner, params={"lang": "uz"})) == (404, "not_found")
