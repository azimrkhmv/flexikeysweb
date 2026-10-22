"""IQ6: the therapist's section L of the CEO's questionnaire. Its scores stay with therapists (rule 1); the
therapist's restrictions (T6, the questionnaire's L9) end a red-flag hold and replace its restrictions (rule 4), and
the GMFCS (T2, the questionnaire's L2) sets the movement level."""

from typing import Any

from fastapi.testclient import TestClient

from tests.test_children import API
from tests.test_intake_bridge import client, finished, plan_of  # noqa: F401
from tests.test_intake_questionnaire import CP_WALKING
from tests.test_plan_create import approved_putty  # noqa: F401
from tests.test_therapist_form import PHYSIO, form, share
from tests.test_videos_register import title

SCORES = {"L1": "2026-10-20", "L1_center": "Clinic 1", "L3_B": 62.5, "L3": 48, "L4": "mid_chest", "L7": "no",
          "L7_text": "Tired after a long trip", "L9_areas": ["left_leg"]}  # fmt: skip


def therapist_of(
    client: TestClient,  # noqa: F811
    owner: dict[str, str],
    child: str,
) -> dict[str, str]:
    therapist = share(client, owner, child)
    client.put(f"{API}/therapist/profile", headers=therapist, json=PHYSIO)
    return therapist


def test_section_l_is_saved_for_therapists_only(client: TestClient) -> None:  # noqa: F811
    owner, child = finished(client, CP_WALKING)
    therapist = therapist_of(client, owner, child)
    saved = form(client, therapist, child, {"L": SCORES})
    assert saved.status_code == 200, saved.text
    assert saved.json()["answers"]["L"] == SCORES
    in_use: Any = client.get(f"{API}/children/{child}/answers-in-use", headers=owner).json()
    assert "48" not in str(in_use) and "62.5" not in str(in_use) and "L3" not in str(in_use)  # never to the parent


def test_wrong_section_l_answers_are_refused(client: TestClient) -> None:  # noqa: F811
    owner, child = finished(client, CP_WALKING)
    therapist = therapist_of(client, owner, child)
    for bad in ({"L3": 120}, {"L4": "knees"}, {"L2": "iii"}, {"L9": "no jumping"}, {"P12": "walks"}, {}):
        assert title(form(client, therapist, child, {"L": bad})) == (422, "invalid_answer"), bad


def test_a_therapists_restrictions_end_a_hold(client: TestClient, approved_putty: None) -> None:  # noqa: F811
    owner, child = finished(client, CP_WALKING | {"C12": "yes", "C12_text": "Stopped crawling"})
    assert plan_of(client, child).exercises_allowed is False  # lost a skill: games only until a therapist looks
    therapist = therapist_of(client, owner, child)
    saved = form(client, therapist, child, {"T6": {"items": ["high_intensity"], "text": ""}})
    assert saved.status_code == 200, saved.text
    assert saved.json()["planRebuilt"] is True
    assert plan_of(client, child).exercises_allowed is True
    in_use = client.get(f"{API}/children/{child}/answers-in-use", headers=owner).json()
    assert in_use["answers"]["_hold"] == [] and in_use["answers"]["P14"] == ["high_intensity"]
