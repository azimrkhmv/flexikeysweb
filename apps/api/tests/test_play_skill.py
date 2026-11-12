"""A6.6: the server's skill model gives exactly the website's numbers (the spec's formulas, §13)."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

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
    assert skill.START_FROM == CASES["start_from"]


def test_difficulty_from_tier_and_step() -> None:
    for c in CASES["difficulty"]:
        assert skill.difficulty(c["tier"], c["step"]) == pytest.approx(c["d"], abs=1e-12)
    for c in CASES["elo_step"]:
        d = skill.try_difficulty(0, c["tier"], c["step"])
        assert skill.elo(c["theta"], c["n"], d, c["correct"]) == pytest.approx(c["out"], abs=1e-12)
    attention = [g for g in skill.GAMES if g["area"] == "attention"]
    for c in CASES["level_for"]:
        assert skill._level_for(c["theta"], c["p"], attention)["activity_id"] == c["out"]


def test_starting_guess() -> None:
    for c in CASES["starting"]:
        assert skill.starting_theta(c["area"], c["parent"], c["therapist"]) == pytest.approx(c["theta"], abs=1e-12)


def test_play_check_correction() -> None:
    for c in CASES["corrected"]:
        assert skill.corrected(c["theta"], c["bucket"]) == pytest.approx(c["out"], abs=1e-12)


def test_elo() -> None:
    for c in CASES["elo"]:
        assert skill.try_difficulty(c["level"], None, None) == pytest.approx(c["d"], abs=1e-12)  # old tries
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


def test_game_choice_and_one_new_game_a_week() -> None:
    by_id = {g["activity_id"]: g for g in skill.GAMES}
    for c in CASES["choose"]:
        got = skill.choose_games(c["theta"], [by_id[a] for a in c["unlocked"]])
        assert [
            {"slot": s["slot"], "area": s["area"], "games": [g["activity_id"] for g in s["games"]]} for s in got
        ] == c["out"]
    four = [g for g in skill.GAMES if g["level"] <= 4]
    for c in CASES["weekly"]:
        assert [g["activity_id"] for g in skill.weekly_new(four, c["played"], c["today"])] == c["out"]


def _key(g: dict[str, Any]) -> str:
    return f"{g['activity_id']}@{g['tier']}.{g['step']}"


def test_tiers_open_by_success_and_seed_is_free() -> None:
    for c in CASES["open_tiers"]:
        assert skill.open_tiers(c["top"], c["theta"], c["clean"]) == c["out"], c
    for c in CASES["open_steps"]:
        assert [_key(g) for g in skill.open_skill_steps(skill.SKILL_STEPS, c["top"], c["pro"])] == c["out"]
    for c in CASES["choose_skill"]:
        worlds = [g for g in skill.GAMES if g["level"] <= c["up_to"]]
        got = skill.choose_games(c["theta"], worlds + skill.open_skill_steps(skill.SKILL_STEPS, c["top"], c["pro"]))
        assert [{"slot": s["slot"], "area": s["area"], "games": [_key(g) for g in s["games"]]} for s in got] == c["out"]
    assert len(skill.SKILL_STEPS) == 12 * len({g["kind"] for g in skill.SKILL_STEPS})


def test_speed_opens_only_for_steady_touch_and_scores_by_time() -> None:
    for c in CASES["speed_open"]:
        recent = [k < c["events"] for k in range(c["tries"])]
        assert skill.speed_open(c["access"], recent) == c["out"], c
    for c in CASES["speed_window"]:
        assert skill.speed_window(c["tier"], c["step"]) == c["ms"]
    for c in CASES["speed_correct"]:
        assert skill.speed_correct(c["correct"], c["response_ms"], c["tier"], c["step"]) == c["out"], c
    # Never for a child who plays by dwell or switch, however steady (games spec §7.1).
    steady = [False] * 40
    assert not skill.speed_open({"input_mode": "dwell", "repeat_lock": False, "release_ok": True}, steady)
    assert not skill.speed_open({"input_mode": "switch", "repeat_lock": False, "release_ok": True}, steady)
    assert skill.speed_open({"input_mode": "touch", "repeat_lock": False, "release_ok": True}, steady)
