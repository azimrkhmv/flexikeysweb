"""B103: the quick start. A first plan from the quick questions, marked quick; the round stays open, and finishing
the full questionnaire builds the plan again without the mark. A therapist's change keeps a quick plan quick."""

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.intake import questionnaire
from app.settings import settings
from tests.test_children import API, add_child, parent
from tests.test_intake_bridge import plan_of
from tests.test_intake_questionnaire import CP_WALKING, NEW, complete, sample
from tests.test_intake_rounds import finish
from tests.test_intake_save import health_consent, save


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(settings, "intake_questionnaire", NEW)
    with TestClient(app) as c:
        yield c


def quick_answers(seed: dict[str, Any]) -> dict[str, Any]:
    """The seed plus an answer to every required quick question, until nothing new opens."""
    answers = dict(seed)
    while missing := questionnaire.quick_missing(answers, True, date.today()):
        answers.update({qid: sample(questionnaire.QUESTIONS[qid]) for qid in missing})
    return answers


SEED = CP_WALKING | {"C12": "no", "B6": "no", "B8": "no", "CP3": "no", "E7": "no", "E13": "no", "J9": ["hold"]}


def quick(client: TestClient, auth: dict[str, str], child: str) -> Any:
    return client.post(f"{API}/children/{child}/intake/1/finish?quick=true", headers=auth)


def test_a_quick_plan_comes_from_the_quick_questions_and_the_round_stays_open(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    answers = quick_answers(SEED)
    assert "A4" not in answers and "A4_kg" not in answers  # no height and weight
    assert len(questionnaire.quick_visible(answers, date.today())) <= 23

    assert save(client, owner, child, {"A1": "Ali"}).status_code == 200
    r = quick(client, owner, child)
    assert r.status_code == 422 and r.json()["title"] == "round_incomplete"  # the quick questions first

    assert save(client, owner, child, answers).status_code == 200
    r = quick(client, owner, child)
    assert r.status_code == 200, r.text
    assert r.json()["completedAt"] is None  # the round waits for the rest of the questions
    assert plan_of(client, child).quick is True
    plan = client.get(f"{API}/children/{child}/plan", headers=owner).json()
    assert plan["quick"] is True and len(plan["days"]) > 0

    # The full questionnaire: the same round, finished; the new plan is not quick.
    assert save(client, owner, child, complete(answers)).status_code == 200
    assert finish(client, owner, child).status_code == 200
    assert plan_of(client, child).quick is None
    assert client.get(f"{API}/children/{child}/plan", headers=owner).json()["quick"] is False


def test_a_p41_round_has_no_quick_start(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "intake_questionnaire", "p41")
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, {"P1": "Ali"}).status_code == 200  # round 1 starts with the first answer
    r = quick(client, owner, child)
    assert r.status_code == 409 and r.json()["title"] == "quick_not_offered"


def test_a_quick_plan_needs_the_health_consent(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert (
        save(client, owner, child, {"A1": "Ali", "A2": "2019-05-01", "A3": "boy", "A7_langs": ["uzbek"]}).status_code
        == 200
    )
    assert quick(client, owner, child).status_code == 403  # child_consent_required, as for the full questionnaire
