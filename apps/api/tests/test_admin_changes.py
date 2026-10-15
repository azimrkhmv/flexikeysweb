"""A1.8: an admin changes roles and disables accounts; every change is in the audit log."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.modules.accounts.models import Role
from app.modules.audit.models import AuditEntry
from app.modules.auth import tokens
from tests.test_access import person
from tests.test_auth_verify import skip_60_second_wait

API = "/api/v1"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def make(client: TestClient, role: Role) -> tuple[uuid.UUID, dict[str, str], str]:
    """A person with consent: id, Authorization header, and a refresh token (as if signed in on a device)."""

    async def run() -> tuple[uuid.UUID, str, str]:
        async with SessionLocal() as db:
            user = await person(db, role)
            pair = await tokens.issue(db, user)
            await db.commit()
            return user.id, pair.access_token, pair.refresh_token

    uid, access, refresh = client.portal.call(run)  # type: ignore[union-attr]
    return uid, {"Authorization": f"Bearer {access}"}, refresh


def audit_for(client: TestClient, target: uuid.UUID) -> list[tuple[str, uuid.UUID | None, dict[str, Any]]]:
    async def run() -> list[tuple[str, uuid.UUID | None, dict[str, Any]]]:
        async with SessionLocal() as db:
            rows = await db.scalars(
                select(AuditEntry).where(AuditEntry.target_id == target).order_by(AuditEntry.created_at)
            )
            return [(r.action, r.actor_id, r.data) for r in rows]

    return client.portal.call(run)  # type: ignore[union-attr]


def test_role_change_is_logged(client: TestClient) -> None:
    admin_id, admin, _ = make(client, Role.admin)
    uid, _, _ = make(client, Role.physio)
    r = client.patch(f"{API}/admin/users/{uid}", headers=admin, json={"role": "clinic"})
    assert (r.status_code, r.json()["role"]) == (200, "clinic")
    assert audit_for(client, uid) == [("user.role_changed", admin_id, {"before": "physio", "after": "clinic"})]


def test_disabled_account_is_signed_out_at_once(client: TestClient) -> None:
    admin_id, admin, _ = make(client, Role.admin)
    uid, parent, refresh = make(client, Role.parent)
    assert client.patch(f"{API}/me", headers=parent, json={"name": "x"}).status_code == 200  # signed in and working

    r = client.patch(f"{API}/admin/users/{uid}", headers=admin, json={"status": "disabled"})
    assert (r.status_code, r.json()["status"]) == (200, "disabled")

    assert client.patch(f"{API}/me", headers=parent, json={"name": "x"}).status_code == 401  # access token: dead now
    assert client.post(f"{API}/auth/refresh", json={"refreshToken": refresh}).status_code == 401  # refresh: dead
    assert audit_for(client, uid) == [("user.disabled", admin_id, {})]


def test_disabled_person_cannot_sign_in_again_until_enabled(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    code = client.post(f"{API}/auth/phone/start", json={"phone": "907100001"}).json()["demoCode"]
    uid = client.post(f"{API}/auth/phone/verify", json={"phone": "907100001", "code": code}).json()["user"]["id"]
    client.patch(f"{API}/admin/users/{uid}", headers=admin, json={"status": "disabled"})

    skip_60_second_wait("+998907100001")
    code = client.post(f"{API}/auth/phone/start", json={"phone": "907100001"}).json()["demoCode"]
    r = client.post(f"{API}/auth/phone/verify", json={"phone": "907100001", "code": code})
    assert (r.status_code, r.json()["title"]) == (403, "account_disabled")

    client.patch(f"{API}/admin/users/{uid}", headers=admin, json={"status": "active"})
    assert [a for a, _, _ in audit_for(client, uuid.UUID(uid))] == ["user.disabled", "user.enabled"]


def test_staff_creation_is_logged(client: TestClient) -> None:
    admin_id, admin, _ = make(client, Role.admin)
    uid = client.post(f"{API}/admin/users", headers=admin, json={"phone": "907100002", "role": "physio"}).json()["id"]
    assert audit_for(client, uuid.UUID(uid)) == [
        ("user.created", admin_id, {"role": "physio", "phone": "+998907100002"})
    ]


def test_admin_cannot_change_themselves(client: TestClient) -> None:
    admin_id, admin, _ = make(client, Role.admin)
    r = client.patch(f"{API}/admin/users/{admin_id}", headers=admin, json={"status": "disabled"})
    assert (r.status_code, r.json()["title"]) == (409, "cannot_change_self")


def test_only_admins_and_only_real_people(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    uid, parent, _ = make(client, Role.parent)
    r = client.patch(f"{API}/admin/users/{uid}", headers=parent, json={"role": "admin"})
    assert (r.status_code, r.json()["title"]) == (403, "forbidden")
    r = client.patch(f"{API}/admin/users/{uuid.uuid4()}", headers=admin, json={"role": "clinic"})
    assert (r.status_code, r.json()["title"]) == (404, "not_found")
