"""A2.2: child consents. Owner only; taking one back stops the use at once; the helper is refused."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.errors import AppError
from app.main import app
from app.modules.audit.models import AuditEntry
from app.modules.children.consents import ConsentKind, require_consent
from tests.test_children import add_child, add_helper, parent

API = "/api/v1"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def set_consent(client: TestClient, auth: dict[str, str], child: str, kind: str, granted: bool) -> Any:
    return client.put(f"{API}/children/{child}/consents/{kind}", headers=auth, json={"granted": granted})


def allowed(client: TestClient, child: str, kind: ConsentKind) -> bool:
    """What a feature (health answers, clips, therapist sharing) sees when it checks the consent before using it."""

    async def check() -> bool:
        async with SessionLocal() as db:
            try:
                await require_consent(db, uuid.UUID(child), kind)
            except AppError as e:
                assert (e.status, e.code) == (403, "child_consent_required")
                return False
            return True

    return client.portal.call(check)  # type: ignore[union-attr]


def test_nothing_is_given_until_the_owner_gives_it(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    r = client.get(f"{API}/children/{child}/consents", headers=owner)
    assert r.json() == {"health": False, "movementVideos": False, "therapistShare": False, "voiceRecording": False}
    assert not any(allowed(client, child, k) for k in ConsentKind)


@pytest.mark.parametrize("kind", list(ConsentKind))
def test_taking_a_consent_back_stops_its_use(client: TestClient, kind: ConsentKind) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    set_consent(client, owner, child, kind.value, True)
    assert allowed(client, child, kind)
    set_consent(client, owner, child, kind.value, False)
    assert not allowed(client, child, kind)  # the very next use is refused


def test_helper_sees_but_cannot_give_or_take_back(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    assert client.get(f"{API}/children/{child}/consents", headers=helper).status_code == 200
    for granted in (True, False):
        r = set_consent(client, helper, child, "health", granted)
        assert (r.status_code, r.json()["title"]) == (403, "owner_only")
    assert not allowed(client, child, ConsentKind.health)


def test_another_family_gets_not_found(client: TestClient) -> None:
    child = add_child(client, parent(client))
    stranger = parent(client)
    assert client.get(f"{API}/children/{child}/consents", headers=stranger).status_code == 404
    assert set_consent(client, stranger, child, "health", True).status_code == 404


def test_unknown_consent_kind(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert set_consent(client, owner, child, "everything", True).status_code == 422


def test_every_change_is_logged_once(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    set_consent(client, owner, child, "health", True)
    set_consent(client, owner, child, "health", True)  # no change: not logged again
    set_consent(client, owner, child, "health", False)

    async def logged() -> list[tuple[str, dict[str, object]]]:
        async with SessionLocal() as db:
            rows = await db.scalars(
                select(AuditEntry)
                .where(AuditEntry.target_id == uuid.UUID(child), AuditEntry.action.like("child.consent_%"))
                .order_by(AuditEntry.created_at)
            )
            return [(r.action, r.data) for r in rows]

    assert client.portal.call(logged) == [  # type: ignore[union-attr]
        ("child.consent_given", {"kind": "health"}),
        ("child.consent_withdrawn", {"kind": "health"}),
    ]
