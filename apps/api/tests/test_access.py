"""A1.7: roles, "may this person see this child?", and staff accounts made by an admin."""

import subprocess
import sys
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.errors import AppError
from app.main import app
from app.modules.accounts.access import may_see_child, require_child_access
from app.modules.accounts.models import Family, FamilyMember, MemberRole, Role, User
from app.modules.auth import tokens

API = "/api/v1"
_phones = iter(range(1, 10_000))


def phone() -> str:
    return f"+99891400{next(_phones):04d}"


async def person(db: AsyncSession, role: Role, consent: bool = True) -> User:
    user = User(phone=phone(), role=role)
    if consent:
        user.consent_version, user.consent_at = "2026-09-v1", datetime.now(UTC)
    db.add(user)
    await db.flush()
    return user


# --- may this person see this child? Every role x every family membership. ---

MEMBERSHIP = [MemberRole.owner, MemberRole.helper, None]  # None = in another family / in no family


@pytest.mark.anyio
@pytest.mark.parametrize("role", list(Role))
@pytest.mark.parametrize("membership", MEMBERSHIP)
async def test_only_members_of_the_childs_family_see_the_child(
    session: AsyncSession, role: Role, membership: MemberRole | None
) -> None:
    childs_family, other_family = Family(), Family()
    session.add_all([childs_family, other_family])
    user = await person(session, role)
    session.add(
        FamilyMember(
            family_id=(childs_family if membership else other_family).id,
            user_id=user.id,
            role=membership or MemberRole.owner,
        )
    )
    await session.flush()

    allowed = await may_see_child(session, user, childs_family.id)
    assert allowed is (membership is not None)
    if not allowed:
        with pytest.raises(AppError) as e:
            await require_child_access(session, user, childs_family.id)
        assert (e.value.status, e.value.code) == (404, "not_found")  # not "forbidden": the child "does not exist"
    await session.rollback()


# --- staff accounts ---


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def bearer(client: TestClient, role: Role) -> dict[str, str]:
    """A signed-in person with the basic consent, made inside the app's own event loop."""

    async def make() -> str:
        async with SessionLocal() as db:
            user = await person(db, role)
            await db.commit()
            return tokens.access_token(user)

    return {"Authorization": f"Bearer {client.portal.call(make)}"}  # type: ignore[union-attr]


@pytest.fixture
def admin_auth(client: TestClient) -> dict[str, str]:
    return bearer(client, Role.admin)


@pytest.fixture
def parent_auth(client: TestClient) -> dict[str, str]:
    return bearer(client, Role.parent)


def test_admin_creates_a_physiotherapist_who_then_signs_in_as_one(
    client: TestClient, admin_auth: dict[str, str]
) -> None:
    r = client.post(f"{API}/admin/users", headers=admin_auth, json={"phone": "90 700 00 01", "role": "physio"})
    assert r.status_code == 201, r.text
    assert (r.json()["phone"], r.json()["role"]) == ("+998907000001", "physio")

    code = client.post(f"{API}/auth/phone/start", json={"phone": "+998 90 700 00 01"}).json()["demoCode"]
    signed_in = client.post(f"{API}/auth/phone/verify", json={"phone": "907000001", "code": code}).json()
    assert signed_in["isNew"] is False
    assert signed_in["user"]["role"] == "physio"  # not turned into a parent by the first sign-in

    async def families() -> object:
        async with SessionLocal() as db:
            return await db.scalar(select(FamilyMember.id).join(User).where(User.phone == "+998907000001"))

    assert client.portal.call(families) is None  # type: ignore[union-attr]  # and no family was made


def test_admin_can_make_clinic_and_admin_accounts(client: TestClient, admin_auth: dict[str, str]) -> None:
    for role, number in (("clinic", "907000002"), ("admin", "907000003")):
        r = client.post(f"{API}/admin/users", headers=admin_auth, json={"phone": number, "role": role})
        assert (r.status_code, r.json()["role"]) == (201, role)


def test_admin_cannot_make_a_parent_or_take_a_used_number(client: TestClient, admin_auth: dict[str, str]) -> None:
    r = client.post(f"{API}/admin/users", headers=admin_auth, json={"phone": "907000009", "role": "parent"})
    assert r.status_code == 422
    client.post(f"{API}/admin/users", headers=admin_auth, json={"phone": "907000010", "role": "clinic"})
    r = client.post(f"{API}/admin/users", headers=admin_auth, json={"phone": "907000010", "role": "physio"})
    assert (r.status_code, r.json()["title"]) == (409, "phone_taken")


def test_only_an_admin_can_make_staff(client: TestClient, parent_auth: dict[str, str]) -> None:
    r = client.post(f"{API}/admin/users", headers=parent_auth, json={"phone": "907000020", "role": "admin"})
    assert (r.status_code, r.json()["title"]) == (403, "forbidden")


def test_first_admin_from_the_command_line() -> None:
    r = subprocess.run(
        [sys.executable, "-m", "app.cli", "create-admin", "90 700 00 30"], capture_output=True, text=True
    )
    assert r.returncode == 0, r.stderr
    assert "Admin created: +998907000030" in r.stdout
    again = subprocess.run(
        [sys.executable, "-m", "app.cli", "create-admin", "907000030"], capture_output=True, text=True
    )
    assert again.returncode != 0
    assert "phone_taken" in again.stderr
