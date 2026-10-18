"""A8.2: the therapist form T1-T11; a therapist's answer wins over the parent's and carries the therapist's name."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.intake import router as intake_router
from app.modules.videos.router import load_exercises
from tests.test_children import API, add_child, add_helper, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import health_consent, save
from tests.test_therapists import new_phone, sign_in
from tests.test_videos_register import run, title

PHYSIO = {"name": "Dilnoza Karimova", "profession": "physio", "workplace": "Clinic 1"}
FULL = {
    "T2": 3,
    "T3": 2,
    "T5": {"type": "spastic", "parts": "legs"},
    "T6": {"items": ["jumping"], "text": "No standing on one leg"},
    "T7": {"goals": ["walk", "hands"], "own": ["Hold a spoon"]},
}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def share(client: TestClient, owner: dict[str, str], child: str) -> dict[str, str]:
    """A therapist the child is shared with."""
    client.put(f"{API}/children/{child}/consents/therapist_share", headers=owner, json={"granted": True})
    code = client.post(f"{API}/children/{child}/therapists", headers=owner, json={}).json()["code"]
    therapist, _ = sign_in(client, new_phone(), invite_code=code)
    assert client.post(f"{API}/therapist/invites/accept", headers=therapist, json={"code": code}).status_code == 200
    return therapist


def child_with_intake(client: TestClient) -> tuple[dict[str, str], str]:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    assert save(client, owner, child, complete(with_health=True) | {"P12": "walks", "P33": ["eat"]}).status_code == 200
    return owner, child


def form(client: TestClient, who: dict[str, str], child: str, answers: dict[str, Any]) -> Any:
    return client.put(f"{API}/therapist/children/{child}/form", headers=who, json={"answers": answers})


def test_the_profile_decides_the_required_answers(client: TestClient) -> None:
    owner, child = child_with_intake(client)
    therapist = share(client, owner, child)
    assert title(client.get(f"{API}/therapist/profile", headers=therapist)) == (404, "no_profile")
    assert title(form(client, therapist, child, {"T2": 3})) == (409, "profile_needed")
    got = client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO).json()
    assert got["required"] == ["T2", "T3", "T6", "T7"]
    speech = client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO | {"profession": "speech"})
    assert speech.json()["required"] == ["T2", "T4", "T6", "T7"]
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)

    empty = client.get(f"{API}/therapist/children/{child}/form", headers=therapist).json()
    assert (empty["answers"], empty["missing"]) == ({}, ["T2", "T3", "T6", "T7"])
    assert empty["parentAnswers"]["P12"] == "walks" and empty["parentAnswers"]["P33"] == ["eat"]
    saved = form(client, therapist, child, FULL)
    assert saved.status_code == 200, saved.text
    assert saved.json()["missing"] == [] and saved.json()["answers"]["T5"] == FULL["T5"]


@pytest.mark.parametrize(
    "answers",
    [
        {"T2": 6},
        {"T5": {"type": "nope"}},
        {"T6": {"items": ["nothing", "jumping"]}},
        {"T6": {"items": [], "text": " "}},
        {"T7": {"goals": ["walk", "hands", "sit", "eat"]}},
        {"T7": {}},
        {"T8": {"assign": ["putty_squeeze"], "exclude": ["putty_squeeze"]}},
        {"T8": {"exclude": ["no_such_exercise"]}},
        {"T10": "daily"},
        {"T11": ""},
        {"T99": 1},
    ],
)
def test_wrong_answers_save_nothing(client: TestClient, answers: dict[str, Any]) -> None:
    run(client, load_exercises)
    owner, child = child_with_intake(client)
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    got = form(client, therapist, child, {"T11": "Hello"} | answers)
    assert title(got) == (422, "invalid_answer")
    assert client.get(f"{API}/therapist/children/{child}/form", headers=therapist).json()["answers"] == {}


def test_the_therapists_answer_wins_and_carries_their_name(client: TestClient) -> None:
    run(client, load_exercises)
    owner, child = child_with_intake(client)
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    extra = {"T8": {"exclude": ["putty_squeeze"]}, "T10": "monthly", "T11": "Keep going!"}
    assert form(client, therapist, child, FULL | extra).status_code == 200

    helper = add_helper(client, owner)
    used = client.get(f"{API}/children/{child}/answers-in-use", headers=helper).json()
    a = used["answers"]
    assert (a["P12"], a["P10"], a["P11"], a["P33"]) == ("walker", "spastic", "legs", ["walk", "hands"])
    assert a["P14"] == ["jumping", "other"]  # the therapist's text is a restriction of its own
    assert set(used["updatedBy"]) == {"P10", "P11", "P12", "P14", "P33"}
    assert used["updatedBy"]["P12"]["therapistName"] == "Dilnoza Karimova"
    assert used["updatedBy"]["P12"]["profession"] == "physio"
    assert [m["text"] for m in used["messages"]] == ["Keep going!"]

    # A second therapist answers later: the newer answer is used. Taking an answer back brings the older one again.
    second = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=second, json=PHYSIO | {"name": "Aziz"})
    form(client, second, child, {"T2": 4})
    by = client.get(f"{API}/children/{child}/answers-in-use", headers=owner).json()
    assert (by["answers"]["P12"], by["updatedBy"]["P12"]["therapistName"]) == ("wheelchair", "Aziz")
    form(client, second, child, {"T2": None})
    back = client.get(f"{API}/children/{child}/answers-in-use", headers=owner).json()
    assert (back["answers"]["P12"], back["updatedBy"]["P12"]["therapistName"]) == ("walker", "Dilnoza Karimova")

    # The share stops: the restriction stays in use (safety), the therapist can no longer see the form.
    link = client.get(f"{API}/children/{child}/therapists", headers=owner).json()[0]["id"]
    client.delete(f"{API}/children/{child}/therapists/{link}", headers=owner)
    after = client.get(f"{API}/children/{child}/answers-in-use", headers=owner).json()
    assert after["answers"]["P14"] == ["jumping", "other"]
    assert title(client.get(f"{API}/therapist/children/{child}/form", headers=therapist)) == (404, "not_found")


def test_the_plan_is_built_from_the_answers_in_use(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    owner, child = child_with_intake(client)
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    form(client, therapist, child, {"T6": {"items": ["prone"], "text": ""}})
    seen: dict[str, Any] = {}

    async def fake_plan(db: Any, child: Any, round_id: Any, answers: dict[str, Any], *_: Any) -> None:
        seen.update(answers)

    monkeypatch.setattr(intake_router, "create_plan", fake_plan)
    assert finish(client, owner, child).status_code == 200
    assert seen["P14"] == ["prone"]


def test_health_answers_need_the_health_consent(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    assert title(form(client, therapist, child, {"T2": 3})) == (403, "child_consent_required")
    assert form(client, therapist, child, {"T10": "weekly", "T11": "Hi"}).status_code == 200
    # Parents and strangers never reach the form.
    assert title(client.get(f"{API}/therapist/children/{child}/form", headers=owner)) == (404, "not_found")
    assert title(client.get(f"{API}/therapist/profile", headers=owner)) == (403, "forbidden")
