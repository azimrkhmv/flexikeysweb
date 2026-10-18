"""A8.1: the owner shares a child with a therapist by phone or by link; the therapist accepts; stopping cuts access."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_admin_changes import audit_for
from tests.test_children import API, add_child, add_helper, parent
from tests.test_videos_register import title

_phones = iter(range(1, 10_000))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def new_phone() -> str:
    return f"+99891600{next(_phones):04d}"


def sign_in(client: TestClient, phone: str, invite_code: str | None = None) -> tuple[dict[str, str], dict[str, Any]]:
    code = client.post(f"{API}/auth/phone/start", json={"phone": phone}).json()["demoCode"]
    body = {"phone": phone, "code": code, "inviteCode": invite_code}
    got = client.post(f"{API}/auth/phone/verify", json=body).json()
    return {"Authorization": f"Bearer {got['accessToken']}"}, got["user"]


def shared_child(client: TestClient) -> tuple[dict[str, str], str]:
    owner = parent(client)
    child = add_child(client, owner)
    consent = client.put(f"{API}/children/{child}/consents/therapist_share", headers=owner, json={"granted": True})
    assert consent.status_code == 200
    return owner, child


def test_a_phone_invite_the_therapist_accepts_and_the_owner_stops(client: TestClient) -> None:
    owner, child = shared_child(client)
    phone = new_phone()
    sent = client.post(f"{API}/children/{child}/therapists", headers=owner, json={"phone": phone})
    assert sent.status_code == 201, sent.text
    link = sent.json()
    assert (link["status"], link["phone"], link["code"]) == ("invited", phone, None)
    again = client.post(f"{API}/children/{child}/therapists", headers=owner, json={"phone": phone})
    assert title(again) == (409, "already_invited")

    # The invited number signs in for the first time: a therapist account, not a parent with a family.
    therapist, user = sign_in(client, phone)
    assert user["role"] == "therapist"
    assert client.get(f"{API}/children", headers=therapist).json() == []
    invites = client.get(f"{API}/therapist/invites", headers=therapist).json()
    assert [i["id"] for i in invites] == [link["id"]] and invites[0]["childName"] == "Ali"
    assert client.get(f"{API}/therapist/children", headers=therapist).json() == []  # not before accepting

    accepted = client.post(f"{API}/therapist/invites/{link['id']}/accept", headers=therapist)
    assert accepted.status_code == 200 and accepted.json()["id"] == child
    assert [c["id"] for c in client.get(f"{API}/therapist/children", headers=therapist).json()] == [child]
    assert client.get(f"{API}/therapist/children/{child}", headers=therapist).status_code == 200
    assert client.get(f"{API}/therapist/invites", headers=therapist).json() == []
    # A share opens the therapist addresses only, never the family's own.
    assert title(client.get(f"{API}/children/{child}", headers=therapist)) == (404, "not_found")
    assert title(client.get(f"{API}/children/{child}/plan", headers=therapist)) == (404, "not_found")

    seen = client.get(f"{API}/children/{child}/therapists", headers=owner).json()
    assert [(s["status"], s["phone"]) for s in seen] == [("active", phone)]

    # The owner stops the share: the very next request is "not found".
    assert client.delete(f"{API}/children/{child}/therapists/{link['id']}", headers=owner).status_code == 204
    assert title(client.get(f"{API}/therapist/children/{child}", headers=therapist)) == (404, "not_found")
    assert client.get(f"{API}/therapist/children", headers=therapist).json() == []
    assert client.get(f"{API}/children/{child}/therapists", headers=owner).json() == []
    actions = [a for a, _, _ in audit_for(client, uuid.UUID(child))]
    assert {"child.therapist_invited", "child.therapist_accepted", "therapist.child_viewed"} <= set(actions)
    assert actions[-1] == "child.therapist_stopped"


def test_a_link_works_once_and_makes_a_new_number_a_therapist(client: TestClient) -> None:
    owner, child = shared_child(client)
    sent = client.post(f"{API}/children/{child}/therapists", headers=owner, json={}).json()
    code = sent["code"]
    assert sent["phone"] is None and len(code) >= 20
    assert all(s["code"] is None for s in client.get(f"{API}/children/{child}/therapists", headers=owner).json())

    therapist, user = sign_in(client, new_phone(), invite_code=code)
    assert user["role"] == "therapist"
    accepted = client.post(f"{API}/therapist/invites/accept", headers=therapist, json={"code": code})
    assert accepted.status_code == 200 and accepted.json()["id"] == child

    other, other_user = sign_in(client, new_phone(), invite_code=code)  # a used link makes nobody a therapist
    assert other_user["role"] == "parent"
    assert client.post(f"{API}/therapist/invites/accept", headers=other, json={"code": code}).status_code == 403
    second, _ = sign_in(
        client,
        new_phone(),
        invite_code=client.post(f"{API}/children/{child}/therapists", headers=owner, json={}).json()["code"],
    )
    assert title(client.post(f"{API}/therapist/invites/accept", headers=second, json={"code": code})) == (
        404,
        "invite_not_found",
    )


def test_only_the_owner_shares_and_only_with_the_consent(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    url = f"{API}/children/{child}/therapists"
    assert title(client.post(url, headers=owner, json={"phone": new_phone()})) == (403, "child_consent_required")
    client.put(f"{API}/children/{child}/consents/therapist_share", headers=owner, json={"granted": True})
    assert title(client.post(url, headers=helper, json={"phone": new_phone()})) == (403, "owner_only")
    assert client.get(url, headers=helper).status_code == 200  # a helper may see who the child is shared with
    assert title(client.post(url, headers=owner, json={"phone": "123"})) == (422, "invalid_phone")

    # A parent's number cannot be invited as a therapist.
    _, parent_user = sign_in(client, phone := new_phone())
    assert parent_user["role"] == "parent"
    assert title(client.post(url, headers=owner, json={"phone": phone})) == (409, "not_a_therapist")

    for _ in range(5):
        assert client.post(url, headers=owner, json={}).status_code == 201
    assert title(client.post(url, headers=owner, json={})) == (409, "too_many_shares")


def test_taking_back_the_consent_stops_every_share_for_good(client: TestClient) -> None:
    owner, child = shared_child(client)
    code = client.post(f"{API}/children/{child}/therapists", headers=owner, json={}).json()["code"]
    therapist, _ = sign_in(client, new_phone(), invite_code=code)
    client.post(f"{API}/therapist/invites/accept", headers=therapist, json={"code": code})
    consent = f"{API}/children/{child}/consents/therapist_share"
    client.put(consent, headers=owner, json={"granted": False})
    assert title(client.get(f"{API}/therapist/children/{child}", headers=therapist)) == (404, "not_found")
    client.put(consent, headers=owner, json={"granted": True})  # given again later: the old share stays stopped
    assert title(client.get(f"{API}/therapist/children/{child}", headers=therapist)) == (404, "not_found")
    assert client.get(f"{API}/children/{child}/therapists", headers=owner).json() == []


def test_an_existing_therapist_sees_only_their_own_invites(client: TestClient) -> None:
    owner, child = shared_child(client)
    phone = new_phone()
    link = client.post(f"{API}/children/{child}/therapists", headers=owner, json={"phone": phone}).json()
    therapist, _ = sign_in(client, phone)
    stranger, _ = sign_in(
        client,
        new_phone(),
        invite_code=client.post(f"{API}/children/{child}/therapists", headers=owner, json={}).json()["code"],
    )
    # The invite was for another number: it does not exist for this therapist.
    assert title(client.post(f"{API}/therapist/invites/{link['id']}/accept", headers=stranger)) == (
        404,
        "invite_not_found",
    )
    assert client.get(f"{API}/therapist/invites", headers=stranger).json() == []
    # A second phone invite to a number that already has a therapist account goes straight to them.
    owner2, child2 = shared_child(client)
    later = client.post(f"{API}/children/{child2}/therapists", headers=owner2, json={"phone": phone}).json()
    assert {i["id"] for i in client.get(f"{API}/therapist/invites", headers=therapist).json()} == {
        link["id"],
        later["id"],
    }
    # Parents never reach the therapist lists.
    assert title(client.get(f"{API}/therapist/children", headers=owner)) == (403, "forbidden")
