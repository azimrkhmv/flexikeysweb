"""A2.7: finishing a round, and the 3-month repeat that starts with last time's answers."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.db import SessionLocal
from app.main import app
from app.modules.intake.models import IntakeRound
from app.modules.intake.rules import QUESTIONS, Question, is_shown
from tests.test_children import add_child, parent
from tests.test_intake_save import health_consent, save, saved

API = "/api/v1"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def sample(q: Question) -> Any:
    match q.kind:
        case "single":
            return q.options[0]  # type: ignore[index]
        case "multi":
            return [q.options[0]]  # type: ignore[index]
        case "ability":
            return 1
        case "date":
            return "2019-05-01"
    return "x"


def complete(with_health: bool) -> dict[str, Any]:
    """An answer for every required question, including follow-ups the sample answers open."""
    answers: dict[str, Any] = {}
    for q in QUESTIONS.values():  # parents come before their follow-ups in intake.json
        if q.required and (with_health or not q.health_step) and is_shown(q, answers):
            answers[q.id] = sample(q)
    return answers


def finish(client: TestClient, auth: dict[str, str], child: str, number: int = 1) -> Any:
    return client.post(f"{API}/children/{child}/intake/{number}/finish", headers=auth)


def next_round(client: TestClient, auth: dict[str, str], child: str) -> Any:
    return client.post(f"{API}/children/{child}/intake", headers=auth)


def three_months_pass(client: TestClient, child: str) -> None:
    async def run() -> None:
        async with SessionLocal() as db:
            await db.execute(
                update(IntakeRound)
                .where(IntakeRound.child_id == uuid.UUID(child))
                .values(completed_at=datetime.now(UTC) - timedelta(days=91))
            )
            await db.commit()

    client.portal.call(run)  # type: ignore[union-attr]


def test_cannot_finish_with_required_questions_open(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    answers = complete(with_health=False)
    del answers["P33"]
    save(client, owner, child, answers)
    r = finish(client, owner, child)
    assert (r.status_code, r.json()["title"], r.json()["missing"]) == (422, "round_incomplete", ["P33"])


def test_without_health_consent_the_health_sections_are_skipped(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, complete(with_health=False))
    r = finish(client, owner, child)
    assert r.status_code == 200
    assert r.json()["completedAt"]


def test_with_health_consent_health_questions_and_their_follow_ups_count(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    answers = complete(with_health=True) | {"P15": "yes"}  # "yes" opens the follow-up P15_part
    answers.pop("P15_part", None)
    save(client, owner, child, answers)
    r = finish(client, owner, child)
    assert (r.status_code, r.json()["missing"]) == (422, ["P15_part"])
    save(client, owner, child, {"P15_part": ["legs"]})
    assert finish(client, owner, child).status_code == 200


def test_not_sure_counts_as_an_answer(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, complete(with_health=False) | {"P4": None, "P33": None})
    assert finish(client, owner, child).status_code == 200


def test_a_finished_round_cannot_be_finished_again(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    save(client, owner, child, complete(with_health=False))
    finish(client, owner, child)
    assert (finish(client, owner, child).json()["title"]) == "round_finished"


def test_the_repeat_starts_with_last_answers_and_keeps_the_old_round(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    first = complete(with_health=True)
    save(client, owner, child, first)
    finish(client, owner, child)

    r = next_round(client, owner, child)
    assert (r.status_code, r.json()["title"]) == (409, "too_early")  # not 3 months yet

    three_months_pass(client, child)
    r = next_round(client, owner, child)
    assert (r.status_code, r.json()["number"]) == (201, 2)
    assert r.json()["answers"] == first  # filled in with last time's answers, health ones too (decrypted)

    save(client, owner, child, {"P18": 2}, number=2)  # the parent updates one answer
    assert saved(client, owner, child, number=1)["P18"] == 1  # round 1 is untouched
    assert saved(client, owner, child, number=2)["P18"] == 2
    rounds = client.get(f"{API}/children/{child}/intake", headers=owner).json()
    assert [(x["number"], bool(x["completedAt"])) for x in rounds] == [(1, True), (2, False)]


def test_health_answers_are_not_carried_over_after_the_consent_is_taken_back(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    save(client, owner, child, complete(with_health=True))
    finish(client, owner, child)
    client.put(f"{API}/children/{child}/consents/health", headers=owner, json={"granted": False})
    three_months_pass(client, child)
    answers = next_round(client, owner, child).json()["answers"]
    assert not any(QUESTIONS[q].health for q in answers)
    assert answers == complete(with_health=False)


def test_one_open_round_at_a_time(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert next_round(client, owner, child).json()["title"] == "no_first_round"
    save(client, owner, child, {"P1": "Ali"})
    r = next_round(client, owner, child)
    assert (r.status_code, r.json()["title"], r.json()["number"]) == (409, "round_open", 1)
