"""A2.9: the P39 voice note and kept hints are stored with the answers; the family listens to the note again."""

from collections.abc import Iterator

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_children import API, add_child, add_helper, parent
from tests.test_intake_save import save, saved
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def record(client: TestClient, auth: dict[str, str], child: str, data: bytes = b"pretend voice") -> str:
    link = client.post(f"{API}/children/{child}/intake/voice-link", headers=auth).json()
    assert httpx2.put(link["uploadUrl"], content=data, headers={"Content-Type": "audio/webm"}).status_code == 200
    return str(link["storageKey"])


def test_the_voice_note_is_kept_and_the_family_listens_again(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    key = record(client, owner, child)
    assert (
        save(
            client, owner, child, {"P39": "He likes music", "P39_voice": key, "P39_hints": ["loves_music"]}
        ).status_code
        == 200
    )
    assert saved(client, owner, child) == {"P39": "He likes music", "P39_voice": key, "P39_hints": ["loves_music"]}

    helper = add_helper(client, owner)  # another adult of the family, on another device
    url = client.get(f"{API}/children/{child}/intake/1/voice", headers=helper).json()["url"]
    assert httpx2.get(url).content == b"pretend voice"


def test_only_this_childs_uploaded_file(client: TestClient) -> None:
    owner = parent(client)
    child, other = add_child(client, owner), add_child(client, owner, name="Vali")
    not_uploaded = client.post(f"{API}/children/{child}/intake/voice-link", headers=owner).json()["storageKey"]
    for key in (record(client, owner, other), not_uploaded, "videos/anything"):
        r = save(client, owner, child, {"P39_voice": key})
        assert (r.status_code, r.json()["question"]) == (422, "P39_voice"), key


def test_hints_are_short_keys(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    for bad in (["Loves Music"], "loves_music", ["x"] * 11):
        assert save(client, owner, child, {"P39_hints": bad}).status_code == 422


def test_no_voice_note(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, {"P1": "Ali"})
    assert title(client.get(f"{API}/children/{child}/intake/1/voice", headers=owner)) == (404, "not_found")
