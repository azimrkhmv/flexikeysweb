"""A2.1: children belong to a family; members see them, only the owner adds, changes and deletes; at most 3."""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.modules.accounts.models import FamilyMember, MemberRole, Role
from app.modules.audit.models import AuditEntry
from tests.test_admin_changes import make

API = "/api/v1"
ALI = {"name": "Ali", "birthDate": "2019-05-01", "sex": "boy", "color": "sky"}
_phones = iter(range(1, 10_000))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def parent(client: TestClient) -> dict[str, str]:
    """A new parent, signed up the real way: SMS code, then the sign-up step. Owns a new family."""
    phone = f"9150{next(_phones):05d}"
    code = client.post(f"{API}/auth/phone/start", json={"phone": phone}).json()["demoCode"]
    token = client.post(f"{API}/auth/phone/verify", json={"phone": phone, "code": code}).json()["accessToken"]
    auth = {"Authorization": f"Bearer {token}"}
    signup = {"region": "tashkent_city", "district": "Chilonzor", "consent": True}
    assert client.patch(f"{API}/me/signup", headers=auth, json=signup).status_code == 200
    return auth


def add_helper(client: TestClient, owner: dict[str, str]) -> dict[str, str]:
    """A second adult in the owner's family (inviting a helper is A8.4; here it is set up directly)."""
    helper_id, helper, _ = make(client, Role.parent)
    owner_id = client.get(f"{API}/me", headers=owner).json()["id"]

    async def join() -> None:
        async with SessionLocal() as db:
            family = await db.scalar(select(FamilyMember.family_id).where(FamilyMember.user_id == uuid.UUID(owner_id)))
            db.add(FamilyMember(family_id=family, user_id=helper_id, role=MemberRole.helper))
            await db.commit()

    client.portal.call(join)  # type: ignore[union-attr]
    return helper


def add_child(client: TestClient, auth: dict[str, str], **extra: str) -> str:
    r = client.post(f"{API}/children", headers=auth, json=ALI | extra)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def test_owner_adds_and_sees_a_child(client: TestClient) -> None:
    owner = parent(client)
    child_id = add_child(client, owner)
    assert [c["id"] for c in client.get(f"{API}/children", headers=owner).json()] == [child_id]
    got = client.get(f"{API}/children/{child_id}", headers=owner).json()
    assert (got["name"], got["birthDate"], got["sex"], got["lang"]) == ("Ali", "2019-05-01", "boy", "uz")


def test_at_most_3_children_per_family(client: TestClient) -> None:
    owner = parent(client)
    for name in ("A", "B", "C"):
        add_child(client, owner, name=name)
    r = client.post(f"{API}/children", headers=owner, json=ALI)
    assert (r.status_code, r.json()["title"], r.json()["max"]) == (409, "too_many_children", 3)


def test_another_family_cannot_see_or_touch_the_child(client: TestClient) -> None:
    child_id = add_child(client, parent(client))
    stranger = parent(client)
    assert client.get(f"{API}/children", headers=stranger).json() == []
    for method in ("GET", "PATCH", "DELETE"):
        r = client.request(method, f"{API}/children/{child_id}", headers=stranger, json={"name": "X"})
        assert (r.status_code, r.json()["title"]) == (404, "not_found"), method


@pytest.mark.parametrize("role", [Role.therapist, Role.physio, Role.clinic, Role.admin])
def test_staff_outside_the_family_cannot_see_the_child(client: TestClient, role: Role) -> None:
    child_id = add_child(client, parent(client))
    _, staff, _ = make(client, role)
    assert client.get(f"{API}/children/{child_id}", headers=staff).status_code == 404


def test_helper_sees_but_cannot_add_change_or_delete(client: TestClient) -> None:
    owner = parent(client)
    child_id = add_child(client, owner)
    helper = add_helper(client, owner)
    assert client.get(f"{API}/children/{child_id}", headers=helper).status_code == 200
    assert [c["id"] for c in client.get(f"{API}/children", headers=helper).json()] == [child_id]
    for method, url in (("POST", ""), ("PATCH", f"/{child_id}"), ("DELETE", f"/{child_id}")):
        r = client.request(method, f"{API}/children{url}", headers=helper, json=ALI)
        assert (r.status_code, r.json()["title"]) == (403, "owner_only"), method


def test_owner_changes_and_deletes(client: TestClient) -> None:
    owner = parent(client)
    child_id = add_child(client, owner)
    r = client.patch(f"{API}/children/{child_id}", headers=owner, json={"name": "Aziz", "lang": "ru"})
    assert (r.json()["name"], r.json()["lang"], r.json()["sex"]) == ("Aziz", "ru", "boy")
    assert client.delete(f"{API}/children/{child_id}", headers=owner).status_code == 204
    assert client.get(f"{API}/children/{child_id}", headers=owner).status_code == 404

    async def logged() -> list[str]:
        async with SessionLocal() as db:
            rows = await db.scalars(select(AuditEntry.action).where(AuditEntry.target_id == uuid.UUID(child_id)))
            return list(rows)

    assert sorted(client.portal.call(logged)) == ["child.created", "child.deleted"]  # type: ignore[union-attr]


def test_birth_date_must_be_real(client: TestClient) -> None:
    owner = parent(client)
    r = client.post(f"{API}/children", headers=owner, json=ALI | {"birthDate": "2099-01-01"})
    assert (r.status_code, r.json()["title"]) == (422, "invalid_birth_date")
