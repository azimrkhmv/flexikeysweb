"""IQ2: a round of the CEO's questionnaire is saved a few answers at a time, continued later and finished by its own
display rules; health answers are encrypted; a round keeps its question set, so old P1-P41 rounds still open."""

import uuid
from collections.abc import Iterator
from datetime import date, timedelta
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.modules.intake import questionnaire
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.settings import settings
from tests.test_children import API, add_child, parent
from tests.test_intake_rounds import finish, next_round, three_months_pass
from tests.test_intake_save import health_consent, raw, save, saved
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_therapist_form import PHYSIO, share
from tests.test_videos_register import title

NEW = questionnaire.SET


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(settings, "intake_questionnaire", NEW)
    with TestClient(app) as c:
        yield c


def sample(q: dict[str, Any]) -> Any:
    """A valid answer to any parent question (the first option, the lowest number...)."""
    match q["kind"]:
        case "single":
            return q["options"][0]
        case "multi":
            return [next(o for o in q["options"] if o != q["exclusive"])]
        case "text" | "longtext":
            return "Something"
        case "date":
            return "2019-05-01" if q["id"] == "A2" else "2026-01-10"
        case "number" | "scale":
            return q["range"][0]
        case "months":
            return 12
        case "time":
            return "08:00"
        case "file" | "media":
            return []
    raise AssertionError(q["kind"])


def complete(seed: dict[str, Any], health: bool = True) -> dict[str, Any]:
    """The seed plus an answer to every required question the child is shown, until nothing new opens."""
    answers = dict(seed)
    while missing := questionnaire.missing_answers(answers, health, date.today()):
        answers.update({qid: sample(questionnaire.QUESTIONS[qid]) for qid in missing})
    return answers


CP_WALKING = {"A2": "2019-05-01", "B1": ["cp"], "B3_parts": ["left_arm"], "CP1_types": ["spastic"], "CP2": "one_side",
              "C10": "i", "C6": "alone_7m"}  # fmt: skip


def test_a_new_round_uses_the_new_questionnaire_and_is_finished_by_its_rules(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    answers = complete(CP_WALKING)
    first, rest = dict(list(answers.items())[:10]), dict(list(answers.items())[10:])
    assert save(client, owner, child, first).status_code == 200
    r = client.get(f"{API}/children/{child}/intake/1", headers=owner).json()
    assert r["questionnaire"] == NEW and r["answers"] == first  # continue later where the parent stopped
    unfinished = finish(client, owner, child)
    assert title(unfinished) == (422, "round_incomplete")
    assert unfinished.json()["missing"] == questionnaire.missing_answers(first, True, date.today())
    assert "CP3" in unfinished.json()["missing"]  # the CP module opened (R1)
    assert save(client, owner, child, rest).status_code == 200
    done = finish(client, owner, child)
    assert done.status_code == 200, done.text
    assert done.json()["completedAt"] is not None


def test_an_old_home_language_answer_finishes_its_round_and_moves_to_the_next_one(client: TestClient) -> None:
    """B72: a round saved before A7_langs has A7; it still finishes, and the next round has A7_langs ticked."""
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    assert save(client, owner, child, complete(CP_WALKING)).status_code == 200

    async def as_saved_before() -> None:
        async with SessionLocal() as db:
            row = await db.scalar(
                select(IntakeAnswer)
                .join(IntakeRound, IntakeAnswer.round_id == IntakeRound.id)
                .where(IntakeRound.child_id == uuid.UUID(child), IntakeAnswer.question_id == "A7_langs")
            )
            assert row is not None
            row.question_id, row.value = "A7", "russian"
            await db.commit()

    client.portal.call(as_saved_before)  # type: ignore[union-attr]
    assert finish(client, owner, child).status_code == 200
    three_months_pass(client, child)
    r = next_round(client, owner, child).json()
    assert r["answers"]["A7_langs"] == ["russian"] and "A7" not in r["answers"]


def test_a_quick_check_round_finishes_and_the_therapist_sees_what_was_not_asked(client: TestClient) -> None:
    """B76: "No difficulty" hides its section; nothing typical is saved, and the therapist sees what was not asked."""
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    quick = {q["id"]: "none" for q in questionnaire.QUICK_CHECK}
    answers = complete({"A2": "2016-05-01", "B1": ["dcd"], "B3_parts": ["none"]} | quick)
    assert {"C12", "E7", "H5_calm", "H5_active"} <= set(answers)  # always asked
    assert "E13" in questionnaire.visible(answers, date.today())  # always asked, and optional
    assert not {"C3", "C5", "C6", "D4", "E3", "F1", "G1", "H1"} & set(answers)
    assert save(client, owner, child, answers).status_code == 200
    assert finish(client, owner, child).status_code == 200
    assert not {"C6", "F1", "G1"} & set(saved(client, owner, child))  # worked out on read, never saved

    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    got = client.get(f"{API}/therapist/children/{child}/form", headers=therapist).json()
    assert {"C6", "F1", "G1"} <= set(got["notAsked"]) and "C12" not in got["notAsked"]
    assert got["parentAnswers"]["P12"] == "walks"  # the plan reads the typical answer


def test_an_old_round_without_a_quick_check_is_finished_as_before(client: TestClient) -> None:
    """B76: an old child is not asked the Quick check, nothing is filled, and the therapist has nothing to read."""
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    answers = complete({"A2": "2016-05-01", "B1": ["dcd"], "C6": "alone_7m"})
    assert not {q["id"] for q in questionnaire.QUICK_CHECK} & set(answers)
    assert {"F1", "G1", "H1"} <= set(answers)  # nothing was hidden
    assert save(client, owner, child, answers).status_code == 200
    assert finish(client, owner, child).status_code == 200
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    assert client.get(f"{API}/therapist/children/{child}/form", headers=therapist).json()["notAsked"] == []


def test_a_round_is_finished_only_with_the_health_consent(client: TestClient) -> None:
    """B67: the health consent is required (TASKS.md section 3, 1 Nov 2026); there is no "Not now"."""
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, complete({"A2": "2019-05-01"}, health=False)).status_code == 200
    assert title(finish(client, owner, child)) == (403, "child_consent_required")
    health_consent(client, owner, child)
    assert title(finish(client, owner, child)) == (422, "round_incomplete")  # now the health questions are asked


def test_not_sure_counts_except_name_birthday_and_family_facts(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, {"C3": None, "J1": None}).status_code == 200
    for qid in ("A2", "A3", "A4", "A4_kg", "A5", "A7_langs", "A9"):  # B60
        assert title(save(client, owner, child, {qid: None})) == (422, "invalid_answer"), qid
    health_consent(client, owner, child)
    assert save(client, owner, child, {"DS1": None, "E1": None}).status_code == 200  # an older round's (B66)


def test_health_answers_need_the_consent_and_are_encrypted(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert title(save(client, owner, child, {"B1": ["autism"], "A1": "Ali"})) == (403, "child_consent_required")
    assert saved(client, owner, child) == {}  # nothing of that request was saved
    health_consent(client, owner, child)
    assert save(client, owner, child, {"B1": ["autism"], "E7": "yes", "A1": "Ali"}).status_code == 200
    assert raw(client, child, "B1") == [True]  # the readable column stays empty: the answer is encrypted
    assert raw(client, child, "A1") == [False]  # not health: stored as it is
    assert saved(client, owner, child)["B1"] == ["autism"]


@pytest.mark.parametrize(
    ("answer", "reason"),
    [
        ({"P12": "walks"}, "unknown_question"),  # a P1-P41 question in a new round
        ({"L2": "iii"}, "unknown_question"),  # the therapist's section, not the parent's
        ({"C10": "vi"}, "not_an_option"),
        ({"J9": ["sit", "stand", "walk", "hold"]}, "too_many"),
        ({"B7": ["none", "heart"]}, "exclusive_option"),
        ({"A4": 500}, "out_of_range"),
        ({"A4": 29}, "out_of_range"),  # B72: 30-250 cm, 5-200 kg
        ({"A4": 251}, "out_of_range"),
        ({"A4_kg": 4.9}, "out_of_range"),
        ({"A4_kg": 201}, "out_of_range"),
        ({"A7": "russian"}, "unknown_question"),  # retired; A7_langs replaces it (B72)
        ({"A7_langs": ["russian", "klingon"]}, "not_an_option"),
        ({"A2": "2018-02-31"}, "not_a_date"),
        ({"A2": "0001-02-27"}, "age_out_of_range"),
        ({"A2": "2099-01-01"}, "date_in_future"),
        ({"A2": (date.today() - timedelta(days=400)).isoformat()}, "age_out_of_range"),  # 1 year old
        ({"A2": "2000-01-01"}, "age_out_of_range"),
        ({"A2": "2019-05-01", "B4": 200}, "older_than_child"),  # B61: more months than the child is old
        ({"J6": 2.5}, "out_of_range"),
        ({"DD2": 300}, "out_of_range"),
        ({"H6": "25:00"}, "not_a_time"),
        ({"B13": ["children/x/intake/y"]}, "not_files"),
    ],
)
def test_wrong_answers_are_refused(client: TestClient, answer: dict[str, Any], reason: str) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    r = save(client, owner, child, answer)
    assert title(r) == (422, "invalid_answer") and r.json()["reason"] == reason


def test_months_numbers_and_times_are_kept(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    given = {"DD2": "not_yet", "DD2_sit": 9, "A4": 104.5, "J6": 4, "H6": "07:30"}
    assert save(client, owner, child, given).status_code == 200
    assert saved(client, owner, child) == given


def test_old_answers_with_retired_options_stay_valid(client: TestClient) -> None:
    """B61, B62: an answer saved before an option was retired can be saved again."""
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    assert save(client, owner, child, {"B1": ["not_sure"], "C7": "under_7m"}).status_code == 200
    assert save(client, owner, child, {"C7": "home", "C4": "walks", "D12_spoon": "no"}).status_code == 200
    assert title(save(client, owner, child, {"C7": "far"})) == (422, "invalid_answer")


def test_files_must_be_this_childs_uploads(client: TestClient, bucket: None) -> None:  # noqa: F811
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    link = client.post(f"{API}/children/{child}/intake/file-link", headers=owner).json()
    key = link["storageKey"]
    assert title(save(client, owner, child, {"B13": [key]})) == (422, "invalid_answer")  # not uploaded yet
    assert httpx2.put(link["uploadUrl"], content=b"pretend report").status_code == 200
    assert save(client, owner, child, {"B13": [key]}).status_code == 200
    other = add_child(client, owner)
    health_consent(client, owner, other)
    assert title(save(client, owner, other, {"B13": [key]})) == (422, "invalid_answer")  # another child's file
    assert client.post(f"{API}/children/{child}/intake/file-link", headers=parent(client)).status_code == 404


def test_an_old_round_keeps_its_questions(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    monkeypatch.setattr(settings, "intake_questionnaire", "p41")
    assert save(client, owner, child, {"P1": "Ali"}).status_code == 200
    monkeypatch.setattr(settings, "intake_questionnaire", NEW)  # the switch happens while a round is open
    r = client.get(f"{API}/children/{child}/intake/1", headers=owner).json()
    assert r["questionnaire"] == "p41" and r["answers"] == {"P1": "Ali"}
    assert save(client, owner, child, {"P3": "boy"}).status_code == 200  # still P questions
    assert title(save(client, owner, child, {"A3": "boy"})) == (422, "invalid_answer")
    rounds = client.get(f"{API}/children/{child}/intake", headers=owner).json()
    assert [r["questionnaire"] for r in rounds] == ["p41"]
    assert client.get(f"{API}/intake/questionnaire", headers=owner).json() == {"active": NEW}  # for a new child
