"""A2.4: saving intake answers a few at a time."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text, update

from app.db import SessionLocal
from app.main import app
from app.modules.intake.models import IntakeRound
from tests.test_children import add_child, add_helper, parent

API = "/api/v1"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def save(client: TestClient, auth: dict[str, str], child: str, answers: dict[str, Any], number: int = 1) -> Any:
    return client.put(f"{API}/children/{child}/intake/{number}", headers=auth, json={"answers": answers})


def saved(client: TestClient, auth: dict[str, str], child: str, number: int = 1) -> dict[str, Any]:
    r = client.get(f"{API}/children/{child}/intake/{number}", headers=auth)
    return r.json()["answers"] if r.status_code == 200 else {}


def raw(client: TestClient, child: str, question: str) -> list[Any]:
    """The value column as PostgreSQL stores it (`value is null`, not the JSON word null)."""

    async def run() -> list[Any]:
        async with SessionLocal() as db:
            rows = await db.execute(
                text(
                    "select a.value is null from intake_answers a join intake_rounds r on r.id = a.round_id "
                    "where r.child_id = :c and a.question_id = :q"
                ),
                {"c": uuid.UUID(child), "q": question},
            )
            return [row[0] for row in rows]

    return client.portal.call(run)  # type: ignore[union-attr]


def health_consent(client: TestClient, owner: dict[str, str], child: str) -> None:
    r = client.put(f"{API}/children/{child}/consents/health", headers=owner, json={"granted": True})
    assert r.status_code == 200


def test_not_sure_is_saved_as_empty(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, {"P1": "Ali", "P4": None}).status_code == 200
    assert saved(client, owner, child) == {"P1": "Ali", "P4": None}  # answered "Not sure"
    assert raw(client, child, "P4") == [True]  # SQL NULL in the database
    assert "P3" not in saved(client, owner, child)  # not answered yet is different from "Not sure"


def test_stop_and_continue_later(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, {"P1": "Ali", "P2": "2019-05-01"})
    # ... the parent closes the app and comes back another day ...
    save(client, owner, child, {"P3": "boy", "P1": "Alisher"})
    assert saved(client, owner, child) == {"P1": "Alisher", "P2": "2019-05-01", "P3": "boy"}


def test_health_answers_are_not_saved_without_the_health_consent(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    r = save(client, owner, child, {"P1": "Ali", "P14": ["jumping"]})
    assert (r.status_code, r.json()["title"], r.json()["consent"]) == (403, "child_consent_required", "health")
    assert saved(client, owner, child) == {}  # nothing from that request, not even the non-health answer

    health_consent(client, owner, child)
    assert save(client, owner, child, {"P14": ["jumping"]}).status_code == 200
    assert saved(client, owner, child) == {"P14": ["jumping"]}


def test_a_wrong_answer_saves_nothing(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    r = save(client, owner, child, {"P1": "Ali", "P3": "dragon"})
    assert (r.status_code, r.json()["question"], r.json()["reason"]) == (422, "P3", "not_an_option")
    assert saved(client, owner, child) == {}


def test_helper_answers_too_but_other_families_cannot(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    assert save(client, helper, child, {"P5": "together"}).status_code == 200
    stranger = parent(client)
    assert save(client, stranger, child, {"P5": "parent"}).status_code == 404
    assert client.get(f"{API}/children/{child}/intake/1", headers=stranger).status_code == 404
    assert saved(client, owner, child) == {"P5": "together"}


def test_only_round_1_starts_by_itself(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, {"P1": "Ali"}, number=2).status_code == 404


def test_a_finished_round_is_closed(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, {"P1": "Ali"})

    async def finish() -> None:  # finishing a round is A2.7; here it is set directly
        async with SessionLocal() as db:
            await db.execute(
                update(IntakeRound)
                .where(IntakeRound.child_id == uuid.UUID(child))
                .values(completed_at=datetime.now(UTC))
            )
            await db.commit()

    client.portal.call(finish)  # type: ignore[union-attr]
    r = save(client, owner, child, {"P1": "Aziz"})
    assert (r.status_code, r.json()["title"]) == (409, "round_finished")
