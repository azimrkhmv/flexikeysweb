"""A8.4: the owner invites one second adult by phone; the helper accepts; daily use only; removal cuts access."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from tests.test_admin_changes import make
from tests.test_children import API, add_child, parent
from tests.test_intake_save import save
from tests.test_therapists import new_phone, sign_in
from tests.test_videos_register import title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def phone_of(client: TestClient, who: dict[str, str]) -> str:
    return str(client.get(f"{API}/me", headers=who).json()["phone"])


def joined(client: TestClient, owner: dict[str, str]) -> tuple[dict[str, str], str]:
    """A parent who accepted the owner's invite: their headers and user id."""
    helper = parent(client)
    invite = client.post(f"{API}/family/helpers", headers=owner, json={"phone": phone_of(client, helper)})
    assert invite.status_code == 201, invite.text
    accepted = client.post(f"{API}/me/helper-invites/{invite.json()['id']}/accept", headers=helper)
    assert accepted.status_code == 200, accepted.text
    return helper, accepted.json()["helpers"][0]["userId"]


def test_invite_accept_and_remove(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = parent(client)
    invite = client.post(f"{API}/family/helpers", headers=owner, json={"phone": phone_of(client, helper)}).json()
    again = client.post(f"{API}/family/helpers", headers=owner, json={"phone": phone_of(client, helper)})
    assert title(again) == (409, "already_invited")
    assert [i["id"] for i in client.get(f"{API}/family/helpers", headers=owner).json()["invites"]] == [invite["id"]]

    stranger = parent(client)  # an invite for another number does not exist for them
    assert client.get(f"{API}/me/helper-invites", headers=stranger).json() == []
    assert title(client.post(f"{API}/me/helper-invites/{invite['id']}/accept", headers=stranger)) == (
        404,
        "invite_not_found",
    )
    assert title(client.get(f"{API}/children/{child}", headers=helper)) == (404, "not_found")  # not before accepting

    mine = client.get(f"{API}/me/helper-invites", headers=helper).json()
    assert [i["id"] for i in mine] == [invite["id"]]
    assert client.post(f"{API}/me/helper-invites/{invite['id']}/accept", headers=helper).status_code == 200
    assert [c["id"] for c in client.get(f"{API}/children", headers=helper).json()] == [child]
    assert client.get(f"{API}/me/helper-invites", headers=helper).json() == []
    family = client.get(f"{API}/family/helpers", headers=owner).json()
    assert family["invites"] == [] and len(family["helpers"]) == 1
    assert family["familyId"] == client.get(f"{API}/children/{child}", headers=owner).json()["familyId"]
    helper_id = family["helpers"][0]["userId"]

    # One helper per family (a setting).
    assert title(client.post(f"{API}/family/helpers", headers=owner, json={"phone": new_phone()})) == (
        409,
        "too_many_helpers",
    )
    # The owner removes the helper: the very next request is "not found".
    assert client.delete(f"{API}/family/helpers/{helper_id}", headers=owner).status_code == 204
    assert title(client.get(f"{API}/children/{child}", headers=helper)) == (404, "not_found")
    assert client.get(f"{API}/children", headers=helper).json() == []
    assert title(client.delete(f"{API}/family/helpers/{helper_id}", headers=owner)) == (404, "not_found")


def test_a_helper_does_daily_use_only(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper, _ = joined(client, owner)
    assert save(client, helper, child, {"P1": "Ali"}).status_code == 200  # answering the questions is daily use
    owner_only = [
        ("PATCH", f"/children/{child}", {"name": "X"}),
        ("DELETE", f"/children/{child}", None),
        ("PUT", f"/children/{child}/consents/health", {"granted": True}),
        ("POST", f"/children/{child}/therapists", {}),
    ]
    for method, path, body in owner_only:
        got = client.request(method, API + path, headers=helper, json=body)
        assert title(got) == (403, "owner_only"), (method, path)
    assert client.get(f"{API}/children/{child}", headers=owner).json()["name"] == "Ali"


def test_who_can_be_invited(client: TestClient) -> None:
    owner = parent(client)
    add_child(client, owner)
    assert title(client.post(f"{API}/family/helpers", headers=owner, json={"phone": "12"})) == (422, "invalid_phone")
    assert title(client.post(f"{API}/family/helpers", headers=owner, json={"phone": phone_of(client, owner)})) == (
        409,
        "already_member",
    )
    _, physio, _ = make(client, Role.physio)
    assert title(client.post(f"{API}/family/helpers", headers=owner, json={"phone": phone_of(client, physio)})) == (
        409,
        "not_a_parent",
    )
    assert title(client.post(f"{API}/family/helpers", headers=physio, json={"phone": new_phone()})) == (
        404,
        "no_family",
    )

    # A number with no account yet: the invite waits, and the person sees it after signing in.
    phone = new_phone()
    invite = client.post(f"{API}/family/helpers", headers=owner, json={"phone": phone}).json()
    newcomer, _ = sign_in(client, phone)
    client.patch(
        f"{API}/me/signup", headers=newcomer, json={"region": "tashkent_city", "district": "Chilonzor", "consent": True}
    )
    assert [i["id"] for i in client.get(f"{API}/me/helper-invites", headers=newcomer).json()] == [invite["id"]]
    # The owner takes the invite back before it is accepted.
    assert client.delete(f"{API}/family/helper-invites/{invite['id']}", headers=owner).status_code == 204
    assert title(client.post(f"{API}/me/helper-invites/{invite['id']}/accept", headers=newcomer)) == (
        404,
        "invite_not_found",
    )
