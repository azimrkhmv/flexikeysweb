"""A3.3: the exercise library comes from exercises.json; an admin registers a finished video file, which then waits
for a physiotherapist's review."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.modules.accounts.models import Role
from app.modules.videos.models import Exercise, Video, VideoStatus
from app.modules.videos.router import load_exercises
from tests.test_admin_changes import audit_for, make
from tests.test_children import API
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def run(client: TestClient, fn: Any) -> Any:
    async def go() -> Any:
        async with SessionLocal() as db:
            return await fn(db)

    return client.portal.call(go)  # type: ignore[union-attr]


def upload(client: TestClient, admin: dict[str, str], exercise: str = "putty_squeeze", lang: str = "uz") -> str:
    link = client.post(f"{API}/admin/videos/upload-link", headers=admin, json={"exerciseId": exercise, "lang": lang})
    assert link.status_code == 200, link.text
    assert httpx2.put(link.json()["uploadUrl"], content=b"pretend video").status_code == 200
    return str(link.json()["storageKey"])


def register(
    client: TestClient, admin: dict[str, str], key: str, exercise: str = "putty_squeeze", lang: str = "uz"
) -> httpx2.Response:
    body = {"exerciseId": exercise, "lang": lang, "storageKey": key, "durationS": 90}
    return client.post(f"{API}/admin/videos", headers=admin, json=body)


def title(r: httpx2.Response) -> tuple[int, str]:
    return r.status_code, r.json()["title"]


def test_library_loads_and_keeps_exercises_that_left_it(client: TestClient) -> None:
    async def old_one(db: Any) -> None:
        db.add(
            Exercise(
                id="old_one",
                title={},
                body_area="hands",
                goals=[],
                gmfcs=[],
                ages=[],
                tool=None,
                difficulty=1,
                conflicts=[],
            )
        )
        await db.commit()

    run(client, old_one)
    assert run(client, load_exercises) == 33
    assert run(client, load_exercises) == 33  # running it again changes nothing
    rows = run(client, lambda db: db.execute(select(Exercise.id, Exercise.active, Exercise.difficulty)))
    active = {i: (a, d) for i, a, d in rows}
    assert len([i for i, (a, _) in active.items() if a]) == 33
    assert active["old_one"] == (False, 1)  # old plans can still show it
    assert active["putty_squeeze"] == (True, 1)


def test_a_new_video_waits_for_review(client: TestClient) -> None:
    run(client, load_exercises)
    admin_id, admin, _ = make(client, Role.admin)
    r = register(client, admin, upload(client, admin))
    assert r.status_code == 201, r.text
    video = r.json()
    assert (video["exerciseId"], video["lang"], video["status"], video["durationS"]) == (
        "putty_squeeze",
        "uz",
        "waiting_review",
        90,
    )
    assert audit_for(client, uuid.UUID(video["id"])) == [
        ("video.registered", admin_id, {"exercise": "putty_squeeze", "lang": "uz"})
    ]


def test_a_new_file_replaces_an_approved_one_and_waits_again(client: TestClient) -> None:
    run(client, load_exercises)
    _, admin, _ = make(client, Role.admin)
    ru = ("finger_walk", "ru")
    first = register(client, admin, upload(client, admin, *ru), *ru).json()

    async def approve(db: Any) -> None:
        video = await db.get(Video, uuid.UUID(first["id"]))
        video.status, video.approved_at = VideoStatus.approved, datetime.now(UTC)
        await db.commit()

    run(client, approve)
    second = register(client, admin, upload(client, admin, *ru), *ru)
    assert (second.json()["id"], second.json()["status"]) == (
        first["id"],
        "waiting_review",
    )  # still one video per language
    assert (
        run(client, lambda db: db.scalar(select(Video.approved_at).where(Video.id == uuid.UUID(first["id"])))) is None
    )


def test_refused(client: TestClient) -> None:
    run(client, load_exercises)
    _, admin, _ = make(client, Role.admin)
    key = upload(client, admin)
    assert title(register(client, admin, "videos/putty_squeeze/uz/never-uploaded.mp4")) == (422, "file_missing")
    assert title(register(client, admin, key, "finger_walk")) == (422, "wrong_storage_key")  # another exercise's file
    assert title(register(client, admin, key, "no_such_exercise")) == (422, "unknown_exercise")
    for role in (Role.parent, Role.physio):
        _, someone, _ = make(client, role)
        assert title(register(client, someone, key)) == (403, "forbidden")
        r = client.post(
            f"{API}/admin/videos/upload-link", headers=someone, json={"exerciseId": "putty_squeeze", "lang": "uz"}
        )
        assert title(r) == (403, "forbidden")
