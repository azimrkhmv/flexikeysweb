"""A3.4: the physiotherapist's review queue. Every decision keeps who, when and which file, and is in the audit log."""

import uuid
from collections.abc import Iterator
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.modules.accounts.models import Role
from app.modules.videos.models import Video, VideoReview
from app.modules.videos.router import load_exercises
from tests.test_admin_changes import audit_for, make
from tests.test_children import API
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import register, run, title, upload


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def new_video(client: TestClient, exercise: str = "lacing_card", lang: str = "en") -> str:
    run(client, load_exercises)
    _, admin, _ = make(client, Role.admin)
    r = register(client, admin, upload(client, admin, exercise, lang), exercise, lang)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def queue(client: TestClient, auth: dict[str, str], status: str = "waiting_review") -> dict[str, Any]:
    r = client.get(f"{API}/review/videos", headers=auth, params={"status": status})
    assert r.status_code == 200, r.text
    return {v["id"]: v for v in r.json()}


def decide(
    client: TestClient, auth: dict[str, str], video: str, decision: str, note: str | None = None
) -> httpx2.Response:
    return client.post(f"{API}/review/videos/{video}", headers=auth, json={"decision": decision, "note": note})


def test_the_queue_shows_waiting_videos_with_a_link_to_watch(client: TestClient) -> None:
    video = new_video(client)
    _, physio, _ = make(client, Role.physio)
    item = queue(client, physio)[video]
    assert (item["exerciseId"], item["lang"], item["title"]["en"]) == ("lacing_card", "en", "Lacing card")
    assert httpx2.get(item["watchUrl"]).content == b"pretend video"


def test_approve_keeps_who_when_and_which_file(client: TestClient) -> None:
    video = new_video(client, "spoon_scoop", "uz")
    physio_id, physio, _ = make(client, Role.physio)
    r = decide(client, physio, video, "approved")
    assert (r.status_code, r.json()["status"]) == (200, "approved")
    assert video not in queue(client, physio) and video in queue(client, physio, "approved")

    v = run(client, lambda db: db.get(Video, uuid.UUID(video)))
    assert v.approved_by == physio_id and v.approved_at is not None
    reviews = run(client, lambda db: db.scalars(select(VideoReview).where(VideoReview.video_id == uuid.UUID(video))))
    [review] = list(reviews)
    assert (review.reviewer_id, review.decision, review.storage_key) == (physio_id, "approved", v.storage_key)
    assert review.created_at is not None
    assert audit_for(client, uuid.UUID(video))[-1] == (
        "video.approved",
        physio_id,
        {"note": None, "file": v.storage_key},
    )


def test_reject_and_changes_need_a_note_and_undo_an_approval(client: TestClient) -> None:
    video = new_video(client, "bridge", "ru")
    _, physio, _ = make(client, Role.physio)
    assert title(decide(client, physio, video, "changes_requested", "  ")) == (422, "note_required")
    assert title(decide(client, physio, video, "rejected")) == (422, "note_required")

    assert decide(client, physio, video, "approved").status_code == 200
    r = decide(client, physio, video, "changes_requested", "Slower, please")
    assert r.json()["status"] == "changes_requested"  # a physiotherapist can take an approval back
    v = run(client, lambda db: db.get(Video, uuid.UUID(video)))
    assert v.approved_by is None and v.approved_at is None
    actions = [(a, d.get("note")) for a, _, d in audit_for(client, uuid.UUID(video))]
    assert actions[-2:] == [("video.approved", None), ("video.changes_requested", "Slower, please")]


def test_only_a_physiotherapist_reviews(client: TestClient) -> None:
    video = new_video(client, "chin_tuck", "uz")
    for role in (Role.admin, Role.parent, Role.clinic):
        _, someone, _ = make(client, role)
        assert title(client.get(f"{API}/review/videos", headers=someone)) == (403, "forbidden")
        assert title(decide(client, someone, video, "approved")) == (403, "forbidden")
    _, physio, _ = make(client, Role.physio)
    assert title(decide(client, physio, str(uuid.uuid4()), "approved")) == (404, "not_found")
