"""A8.3: movement and feedback clips, only with the movement-videos consent; only the shared therapist watches and
replies; the parent can delete any clip."""

from collections.abc import Iterator
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app
from app.modules.privacy.router import purge_files
from app.modules.videos.router import load_exercises
from tests.test_billing_plan import on_pro
from tests.test_children import API, add_child, add_helper, parent
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_therapist_form import share
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def allow(client: TestClient, owner: dict[str, str], child: str, granted: bool = True) -> None:
    url = f"{API}/children/{child}/consents/movement_videos"
    assert client.put(url, headers=owner, json={"granted": granted}).status_code == 200


def upload(client: TestClient, who: dict[str, str], child: str) -> str:
    link = client.post(f"{API}/children/{child}/clips/upload-link", headers=who).json()
    assert httpx2.put(link["uploadUrl"], content=b"pretend clip").status_code == 200
    return str(link["storageKey"])


def add(client: TestClient, who: dict[str, str], child: str, kind: str = "movement", **extra: str) -> httpx2.Response:
    body = {"kind": kind, "storageKey": upload(client, who, child), **extra}
    return client.post(f"{API}/children/{child}/clips", headers=who, json=body)


def test_clips_need_the_consent_and_a_real_upload(client: TestClient, bucket: None) -> None:  # noqa: F811
    run(client, load_exercises)
    owner = parent(client)
    child = add_child(client, owner)
    assert title(client.post(f"{API}/children/{child}/clips/upload-link", headers=owner)) == (
        403,
        "child_consent_required",
    )
    allow(client, owner, child)
    fake = {"kind": "movement", "storageKey": f"children/{child}/clips/never-uploaded"}
    assert title(client.post(f"{API}/children/{child}/clips", headers=owner, json=fake)) == (422, "unknown_file")
    other = add_child(client, owner, name="Vali")
    allow(client, owner, other)
    stolen = {"kind": "movement", "storageKey": upload(client, owner, other)}  # another child's file
    assert title(client.post(f"{API}/children/{child}/clips", headers=owner, json=stolen)) == (422, "unknown_file")
    assert title(add(client, owner, child, "feedback", exerciseId="putty_squeeze")) == (403, "pro_only")  # A7.2
    on_pro(client, owner)
    assert title(add(client, owner, child, "feedback")) == (422, "unknown_exercise")
    assert title(add(client, owner, child, "feedback", exerciseId="nope")) == (422, "unknown_exercise")

    helper = add_helper(client, owner)
    assert add(client, helper, child, "feedback", exerciseId="putty_squeeze").status_code == 201
    for _ in range(3):
        assert add(client, owner, child).status_code == 201
    assert title(add(client, owner, child)) == (409, "too_many_clips")
    assert [c["kind"] for c in client.get(f"{API}/children/{child}/clips", headers=owner).json()] == [
        "feedback",
        "movement",
        "movement",
        "movement",
    ]


def test_only_the_shared_therapist_watches_and_replies(client: TestClient, bucket: None) -> None:  # noqa: F811
    owner = parent(client)
    child = add_child(client, owner)
    allow(client, owner, child)
    clip = add(client, owner, child).json()
    therapist = share(client, owner, child)
    other_owner = parent(client)
    stranger = share(client, other_owner, add_child(client, other_owner))  # shared with another child

    seen = client.get(f"{API}/therapist/children/{child}/clips", headers=therapist)
    assert seen.status_code == 200 and [c["id"] for c in seen.json()] == [clip["id"]]
    assert httpx2.get(seen.json()[0]["url"]).content == b"pretend clip"
    assert title(client.get(f"{API}/therapist/children/{child}/clips", headers=stranger)) == (404, "not_found")
    url = f"{API}/therapist/children/{child}/clips/{clip['id']}/replies"
    assert title(client.post(url, headers=stranger, json={"text": "Hi"})) == (404, "not_found")
    assert client.post(url, headers=therapist, json={"text": "Good balance"}).status_code == 201
    mine = client.get(f"{API}/children/{child}/clips", headers=owner).json()
    assert [r["text"] for r in mine[0]["replies"]] == ["Good balance"]

    # Without the consent the therapist sees no clip; the family still sees and can delete their own.
    allow(client, owner, child, granted=False)
    assert title(client.get(f"{API}/therapist/children/{child}/clips", headers=therapist)) == (404, "not_found")
    assert title(client.post(url, headers=therapist, json={"text": "Hi"})) == (404, "not_found")
    assert len(client.get(f"{API}/children/{child}/clips", headers=owner).json()) == 1
    allow(client, owner, child)

    # A stopped share cuts access at once.
    link = client.get(f"{API}/children/{child}/therapists", headers=owner).json()[0]["id"]
    client.delete(f"{API}/children/{child}/therapists/{link}", headers=owner)
    assert title(client.get(f"{API}/therapist/children/{child}/clips", headers=therapist)) == (404, "not_found")


def test_the_parent_deletes_any_clip_and_its_file(client: TestClient, bucket: None) -> None:  # noqa: F811
    owner = parent(client)
    child = add_child(client, owner)
    allow(client, owner, child)
    helper = add_helper(client, owner)
    body = {"kind": "movement", "storageKey": (key := upload(client, helper, child))}
    clip = client.post(f"{API}/children/{child}/clips", headers=helper, json=body).json()
    assert storage.exists(key)
    assert httpx2.get(clip["url"]).status_code == 200
    assert client.delete(f"{API}/children/{child}/clips/{clip['id']}", headers=owner).status_code == 204
    assert not storage.exists(key)
    assert httpx2.get(clip["url"]).status_code == 404  # A12.3: a link given out before stops working at once
    assert client.get(f"{API}/children/{child}/clips", headers=owner).json() == []
    assert title(client.delete(f"{API}/children/{child}/clips/{clip['id']}", headers=owner)) == (404, "not_found")


def test_a_clip_file_storage_could_not_remove_goes_with_the_nightly_cleanup(
    client: TestClient,
    bucket: None,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    allow(client, owner, child)
    key = upload(client, owner, child)
    clip = client.post(
        f"{API}/children/{child}/clips", headers=owner, json={"kind": "movement", "storageKey": key}
    ).json()

    def broken(_key: str) -> None:
        raise ConnectionError

    monkeypatch.setattr(storage, "remove", broken)
    assert client.delete(f"{API}/children/{child}/clips/{clip['id']}", headers=owner).status_code == 204
    assert client.get(f"{API}/children/{child}/clips", headers=owner).json() == []
    monkeypatch.undo()

    async def nightly(db: Any) -> int:
        return await purge_files(db)

    assert storage.exists(key)
    assert run(client, nightly) >= 1
    assert not storage.exists(key)
