"""A6.6: the server's skill model gives exactly the website's numbers (the spec's formulas, §13)."""

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.play import skill
from tests.test_children import API, add_child, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import save
from tests.test_videos_register import title

CASES = json.loads((Path(__file__).parent / "skill_cases.json").read_text("utf-8"))


def test_the_cases_are_the_websites() -> None:
    web = Path(__file__).parents[2] / "web/src/content/backend/skill_cases.json"
    if not web.exists():
        pytest.skip("website files not present")
    assert json.loads(web.read_text("utf-8")) == CASES, "copy the website's file"


def test_same_areas_and_questions() -> None:
    assert skill.AREA_OF == CASES["area_of"]
    assert {a: list(q) for a, q in skill.AREA_QUESTIONS.items()} == CASES["area_questions"]


def test_starting_guess() -> None:
    for c in CASES["starting"]:
        assert skill.starting_theta(c["area"], c["parent"], c["therapist"]) == pytest.approx(c["theta"], abs=1e-12)


def test_play_check_correction() -> None:
    for c in CASES["corrected"]:
        assert skill.corrected(c["theta"], c["bucket"]) == pytest.approx(c["out"], abs=1e-12)


def test_elo() -> None:
    for c in CASES["elo"]:
        assert skill.difficulty(c["level"]) == pytest.approx(c["d"], abs=1e-12)
        assert skill.p_correct(c["theta"], c["d"]) == pytest.approx(c["p"], abs=1e-12)
        assert skill.elo(c["theta"], c["n"], c["d"], c["correct"]) == pytest.approx(c["out"], abs=1e-12)


# ---------------------------------------------------------------- on the server


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_first_guess_from_the_intake_then_the_play_check_wins_by_one_step(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, {**complete(with_health=False), "P23": 2, "P24": 2, "P26": 2}).status_code == 200
    assert finish(client, owner, child).status_code == 200
    got = {s["area"]: s for s in client.get(f"{API}/children/{child}/skills", headers=owner).json()}
    assert set(got) == set(skill.AREAS)
    assert got["access"]["theta"] == pytest.approx(skill.STEP)  # all three hand answers "yes"
    assert got["memory"]["theta"] == pytest.approx(0)  # sample answer 1 = "with help"
    placed = client.post(
        f"{API}/children/{child}/skills/placement", headers=owner, json={"buckets": {"access": "not_yet"}}
    )
    after = {s["area"]: s["theta"] for s in placed.json()}
    assert after["access"] == pytest.approx(0)  # two steps apart: the play check moves it one
    assert title(client.get(f"{API}/children/{child}/skills", headers=parent(client))) == (404, "not_found")
