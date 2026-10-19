"""A8.5: a therapist's change to restrictions, goals or exercises rebuilds the plan, and what they forbid never
appears in it."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.main import app
from app.modules.accounts.models import Role, User
from app.modules.therapists.form import rebuild_plan
from app.modules.videos.models import Video
from tests.test_admin_changes import make
from tests.test_children import API, add_child, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import health_consent, save
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_therapist_form import PHYSIO, form, share
from tests.test_videos_register import run
from tests.test_videos_review import decide, new_video

SIT = ["tummy_time_reach", "look_left_right", "sit_reach_sides"]  # prone, neck flexion, nothing to avoid


@pytest.fixture
def client(bucket: None) -> Iterator[TestClient]:  # noqa: F811
    with TestClient(app) as c:
        _, physio, _ = make(c, Role.physio)
        for exercise in SIT:
            assert decide(c, physio, new_video(c, exercise, "uz"), "approved").status_code == 200
        yield c

        async def forget(db: Any) -> None:  # other tests expect only their own approved videos
            await db.execute(delete(Video).where(Video.exercise_id.in_(SIT)))
            await db.commit()

        run(c, forget)


def exercises(client: TestClient, who: dict[str, str], child: str) -> set[str]:
    plan = client.get(f"{API}/children/{child}/plan", headers=who).json()
    return {e["exerciseId"] for day in plan["days"] for e in day["exercises"]}


def test_a_restriction_or_an_exclusion_never_appears_in_the_new_plan(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    answers: dict[str, Any] = complete(with_health=True) | {"P14": ["nothing"], "P33": ["sit"]}
    assert save(client, owner, child, answers).status_code == 200
    assert finish(client, owner, child).status_code == 200
    assert exercises(client, owner, child) == set(SIT)

    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    first = client.get(f"{API}/children/{child}/plan", headers=owner).json()["id"]
    saved = form(client, therapist, child, {"T6": {"items": ["prone"], "text": ""}})
    assert saved.json()["planRebuilt"] is True
    assert client.get(f"{API}/children/{child}/plan", headers=owner).json()["id"] != first
    assert exercises(client, owner, child) == {"look_left_right", "sit_reach_sides"}

    form(client, therapist, child, {"T8": {"exclude": ["look_left_right"]}})
    assert exercises(client, owner, child) == {"sit_reach_sides"}

    # A message changes nothing in the plan.
    before = client.get(f"{API}/children/{child}/plan", headers=owner).json()["id"]
    assert form(client, therapist, child, {"T11": "Well done"}).json()["planRebuilt"] is False
    assert client.get(f"{API}/children/{child}/plan", headers=owner).json()["id"] == before


def test_no_plan_yet_means_nothing_to_rebuild(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    saved = form(client, therapist, child, {"T6": {"items": ["prone"], "text": ""}})
    assert saved.status_code == 200 and saved.json()["planRebuilt"] is False
    answers: dict[str, Any] = complete(with_health=True) | {"P14": ["nothing"], "P33": ["sit"]}
    save(client, owner, child, answers)
    assert finish(client, owner, child).status_code == 200  # the first plan already follows the therapist
    assert exercises(client, owner, child) == {"look_left_right", "sit_reach_sides"}


def test_a_deleted_therapists_restriction_stays(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    save(client, owner, child, complete(with_health=True) | {"P14": ["nothing"], "P33": ["sit"]})
    finish(client, owner, child)
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    form(client, therapist, child, {"T6": {"items": ["prone"], "text": ""}})
    me = client.get(f"{API}/me", headers=therapist).json()["id"]

    async def delete_account(db: Any) -> None:
        await db.delete(await db.get(User, uuid.UUID(me)))
        await db.commit()

    run(client, delete_account)

    async def new_plan(db: Any) -> None:  # any later plan, for example after the next question round
        assert await rebuild_plan(db, uuid.UUID(child))
        await db.commit()

    run(client, new_plan)
    assert "tummy_time_reach" not in exercises(client, owner, child)  # its "no lying on the stomach" still holds
    used = client.get(f"{API}/children/{child}/answers-in-use", headers=owner).json()
    assert "prone" in used["answers"]["P14"] and used["updatedBy"]["P14"]["therapistName"] is None
