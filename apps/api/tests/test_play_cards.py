"""A6.8: the parent's own My Voice cards, with photo and recorded voice, the same on every device of the family."""

from collections.abc import Iterator
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_child_consents import set_consent
from tests.test_children import API, add_child, add_helper, parent
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def upload(client: TestClient, who: dict[str, str], child: str, kind: str, data: bytes) -> str:
    link = client.post(f"{API}/children/{child}/voice-cards/upload-link", headers=who, json={"kind": kind}).json()
    assert httpx2.put(link["uploadUrl"], content=data).status_code == 200
    return str(link["storageKey"])


def cards(client: TestClient, who: dict[str, str], child: str) -> Any:
    return client.get(f"{API}/children/{child}/voice-cards", headers=who).json()


def test_a_card_made_on_one_device_is_on_the_other(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)  # another adult, another phone
    set_consent(client, owner, child, "voice_recording", True)
    photo = upload(client, owner, child, "photo", b"\x89PNG grandma")
    voice = upload(client, owner, child, "audio", b"OggS hello")
    made = client.post(
        f"{API}/children/{child}/voice-cards",
        headers=owner,
        json={"category": "people", "label": "Grandma", "emoji": "👵", "photoKey": photo, "audioKey": voice},
    )
    assert made.status_code == 201, made.text
    (card,) = cards(client, helper, child)
    assert (card["label"], card["emoji"]) == ("Grandma", "👵")
    assert httpx2.get(card["photoUrl"]).content == b"\x89PNG grandma"
    assert httpx2.get(card["audioUrl"]).content == b"OggS hello"

    url = f"{API}/children/{child}/voice-cards/{card['id']}"
    assert client.patch(url, headers=helper, json={"label": "Buvi"}).json()["label"] == "Buvi"
    assert cards(client, owner, child)[0]["label"] == "Buvi"
    assert client.delete(url, headers=owner).status_code == 204
    assert cards(client, helper, child) == []
    assert httpx2.get(card["photoUrl"]).status_code == 404  # the file is gone too


def test_only_own_files_and_only_the_family(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    other = add_child(client, parent(client))
    set_consent(client, owner, child, "voice_recording", True)
    card: dict[str, Any] = {"category": "food", "label": "Non", "emoji": "🍞"}
    assert title(
        client.post(
            f"{API}/children/{child}/voice-cards", headers=owner, json={**card, "photoKey": f"children/{other}/voice/x"}
        )
    ) == (422, "unknown_file")
    assert title(
        client.post(
            f"{API}/children/{child}/voice-cards",
            headers=owner,
            json={**card, "audioKey": f"children/{child}/voice/never-uploaded"},
        )
    ) == (422, "unknown_file")
    assert title(client.get(f"{API}/children/{child}/voice-cards", headers=parent(client))) == (404, "not_found")


def test_a_recorded_voice_needs_its_own_consent(client: TestClient) -> None:
    """G8: no recorded voice without the voice_recording consent; taking it back deletes the recordings at once."""
    owner = parent(client)
    child = add_child(client, owner)
    link = f"{API}/children/{child}/voice-cards/upload-link"
    assert title(client.post(link, headers=owner, json={"kind": "audio"})) == (403, "child_consent_required")
    photo = upload(client, owner, child, "photo", b"\x89PNG cat")  # a photo needs only the family
    set_consent(client, owner, child, "voice_recording", True)
    voice = upload(client, owner, child, "audio", b"OggS mosh")
    body = {"category": "people", "label": "Mosh", "emoji": "🐈", "photoKey": photo, "audioKey": voice}
    card = client.post(f"{API}/children/{child}/voice-cards", headers=owner, json=body).json()

    set_consent(client, owner, child, "voice_recording", False)
    (kept,) = cards(client, owner, child)
    assert (kept["label"], kept["audioUrl"]) == ("Mosh", None) and kept["photoUrl"]
    assert httpx2.get(card["audioUrl"]).status_code == 404  # the recording is gone from storage
    assert title(client.post(f"{API}/children/{child}/voice-cards", headers=owner, json=body)) == (
        403,
        "child_consent_required",
    )
    url = f"{API}/children/{child}/voice-cards/{card['id']}"
    assert title(client.patch(url, headers=owner, json={"audioKey": voice})) == (403, "child_consent_required")
