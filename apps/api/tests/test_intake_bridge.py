"""IQ3: answers to the CEO's questionnaire are read as the P answers the plan, the skill model and the assistant use;
"Not sure" or no answer gives the cautious choice, and every red flag holds or removes what it says."""

import json
from collections.abc import Iterator
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.modules.intake.bridge import p_view
from app.modules.plans.models import Plan
from app.modules.plans.safety import P14_TAGS, plan_facts
from app.settings import settings
from tests.test_children import API, add_child, parent
from tests.test_intake_questionnaire import CP_WALKING, NEW, complete
from tests.test_intake_rounds import finish
from tests.test_intake_save import health_consent, save
from tests.test_plan_create import approved_putty  # noqa: F401
from tests.test_videos_register import run

TODAY = date(2026, 10, 22)
RECENT, LONG_AGO = (TODAY - timedelta(days=40)).isoformat(), (TODAY - timedelta(days=400)).isoformat()


def facts(answers: dict[str, Any], health: bool = True) -> Any:
    return plan_facts(p_view(answers, TODAY), birth_date=date(2019, 5, 1), start_date=TODAY, health_consent=health)


def test_no_answers_is_the_cautious_plan() -> None:
    f = facts({})
    assert set(P14_TAGS) | {"standing", "walking", "high_intensity", "mouth_face"} <= f.restrictions
    assert f.gmfcs is None and f.minutes == 10 and f.exercises_allowed


def test_answers_are_read_as_p_answers() -> None:
    p = p_view(complete(CP_WALKING | {"J9": ["walk", "hold", "tablet"], "J1": "45", "D4": "thumb_finger",
                                     "F1": "gesture", "G1": ["sentences"]}), TODAY)  # fmt: skip
    assert (p["P12"], p["P33"], p["P34"], p["P23"], p["P18"], p["P21"]) == (
        "walks", ["walk", "hands", "understand"], "30", 2, 1, 2,
    )  # fmt: skip
    assert p["P14"] is None  # never asked: every listed restriction until a therapist sets them (IQ6)
    f = facts(p_view_input := complete(CP_WALKING))
    assert f.gmfcs == 1 and "standing" not in f.restrictions and set(P14_TAGS) <= f.restrictions
    assert p_view_input["C10"] == "i"


def test_without_the_gmfcs_picture_walking_and_sitting_set_the_level() -> None:
    assert p_view({"B1": ["dcd"], "C6": "alone_7m"}, TODAY)["P12"] == "walks"
    assert (
        p_view({"B1": ["developmental_delay"], "C6": "doesnt_step", "C3": "cant_sit"}, TODAY)["P12"] == "needs_help_sit"
    )
    assert "P12" not in p_view({"B1": ["dcd"]}, TODAY)  # not answered: the cautious level


@pytest.mark.parametrize(
    ("answers", "hold"),
    [
        ({"C12": "yes"}, "lost_skill"),
        ({"B8": "yes", "B8_type": ["hip"], "B8_date": RECENT}, "recent_surgery_or_botox"),
        ({"B1": ["cp"], "CP3": "yes", "CP3_date": None}, "recent_surgery_or_botox"),  # no date: counted as recent
        ({"B6": "still"}, "seizures"),
        ({"B7": ["heart"]}, "heart"),
        ({"B1": ["down_syndrome"], "DS2": "yes"}, "heart"),
        ({"B1": ["autism"]}, "autism_only"),
    ],
)
def test_red_flags_hold_every_exercise(answers: dict[str, Any], hold: str) -> None:
    assert hold in p_view(answers, TODAY)["_hold"]
    assert not facts(answers).exercises_allowed


def test_no_plan_waits_for_a_therapist() -> None:
    """A4.8: Down syndrome and frequent pain with no place marked get exercises, with their restrictions."""
    down = facts({"B1": ["down_syndrome"], "DS1": "not_checked"})
    assert down.exercises_allowed and {"neck_flexion", "prone"} <= down.restrictions
    pain = facts({"B1": ["cp"], "E3": "often"})
    assert pain.exercises_allowed and "high_intensity" in pain.restrictions


def test_the_next_round_lifts_a_hold_once_the_answer_changed() -> None:
    """A4.8: the monthly re-check asks again; once the surgery is over 6 months ago, or the seizures are controlled,
    exercises come."""
    assert not facts({"B8": "yes", "B8_type": ["hip"], "B8_date": RECENT, "C12": "no"}).exercises_allowed
    assert facts({"B8": "yes", "B8_type": ["hip"], "B8_date": LONG_AGO, "C12": "no"}).exercises_allowed
    assert facts({"C12": "no", "B6": "controlled"}).exercises_allowed


def test_old_surgery_and_two_diagnoses_do_not_hold() -> None:
    p = p_view({"B1": ["cp", "autism"], "B8": "yes", "B8_type": ["hip"], "B8_date": LONG_AGO, "CP3": "no"}, TODAY)
    assert p["_hold"] == [] and p["P15"] == "no"


def test_red_flags_add_restrictions_and_leave_out_body_areas() -> None:
    assert {"neck_flexion", "prone"} <= set(
        p_view({"B1": ["down_syndrome"], "DS1": "not_checked"}, TODAY)["_restrictions"]
    )
    assert "high_intensity" in p_view({"E7": "yes", "E7_where": ["left_leg"]}, TODAY)["_restrictions"]
    assert facts({"E7": "yes", "E7_where": ["left_leg"]}).surgery == {"legs"}
    assert {"prone", "neck_flexion"} <= set(p_view({"B7": ["shunt"]}, TODAY)["_restrictions"])
    assert {"leg_balance", "high_intensity"} <= set(p_view({"B1": ["not_sure"], "DD4": "yes"}, TODAY)["_restrictions"])
    assert facts({"E3": "sometimes", "E4": ["right_hand"]}).surgery == {"hands"}
    assert "mouth_face" in facts({"E10": "sometimes"}).restrictions
    assert "mouth_face" not in facts({"E10": "never"}).restrictions


# ---------------------------------------------------------------- the plan is made from a new round


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(settings, "intake_questionnaire", NEW)
    with TestClient(app) as c:
        yield c


def plan_of(client: TestClient, child: str) -> Any:
    import uuid

    async def go(db: Any) -> Any:
        return await db.scalar(
            select(Plan).where(Plan.child_id == uuid.UUID(child)).order_by(Plan.created_at.desc())
        )  # the newest

    return run(client, go)


def finished(client: TestClient, seed: dict[str, Any]) -> tuple[dict[str, str], str]:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    assert save(client, owner, child, complete(seed)).status_code == 200
    assert finish(client, owner, child).status_code == 200
    return owner, child


def test_a_plan_is_made_from_a_new_round(client: TestClient, approved_putty: None) -> None:  # noqa: F811
    owner, child = finished(client, CP_WALKING | {"C12": "no", "B6": "no", "B8": "no", "CP3": "no", "J9": ["hold"]})
    assert plan_of(client, child).exercises_allowed is True
    plan = client.get(f"{API}/children/{child}/plan", headers=owner).json()
    assert any(day["exercises"] for day in plan["days"])  # the putty exercise is in it


def test_a_red_flag_gives_a_games_only_plan(client: TestClient) -> None:
    _, child = finished(client, CP_WALKING | {"C12": "yes", "C12_text": "Stopped crawling"})
    assert plan_of(client, child).exercises_allowed is False


def test_the_assistant_avoids_what_the_new_answers_forbid(client: TestClient) -> None:
    owner, child = finished(client, CP_WALKING)
    from app.modules.assistant.ai import FakeAi, get_ai

    fake = FakeAi()
    app.dependency_overrides[get_ai] = lambda: fake
    try:
        client.post(f"{API}/children/{child}/assistant/messages", headers=owner, json={"text": "Hi", "lang": "en"})
    finally:
        app.dependency_overrides.pop(get_ai)
    told = fake.sent[0][0]["content"]
    assert "jumping" in told and "lying on the tummy" in told  # P14 not asked: every listed restriction


BRIDGE_CASES: list[dict[str, Any]] = json.loads((Path(__file__).parent / "bridge_cases.json").read_text("utf-8"))


@pytest.mark.parametrize("case", BRIDGE_CASES, ids=[c["name"] for c in BRIDGE_CASES])
def test_the_server_reads_answers_as_the_website_does(case: dict[str, Any]) -> None:
    """IQ4: bridge_cases.json is written by apps/web/src/content/questionnaireBridge.test.ts."""
    assert p_view(case["answers"], date.fromisoformat(case["today"])) == case["p"]
