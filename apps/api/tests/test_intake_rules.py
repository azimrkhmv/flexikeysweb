"""A2.3: the server checks intake answers with the website's own rules."""

import json
from pathlib import Path
from typing import Any

import pytest

from app.errors import AppError
from app.modules.intake.rules import QUESTIONS, check_answer, is_shown, problem_with


def test_all_questions_are_loaded() -> None:
    assert len(QUESTIONS) == 43 + 2  # + the P39 voice note and hints (A2.9)
    assert QUESTIONS["P14"].exclusive == "nothing"
    assert QUESTIONS["P10"].show_if == ("P9", "cp")
    assert QUESTIONS["P10"].health and not QUESTIONS["P1"].health


def test_rules_match_the_website() -> None:
    web = Path(__file__).parents[2] / "web/src/content/backend/intake.json"
    if not web.exists():
        pytest.skip("website files not present")
    server = Path(__file__).parents[1] / "app/content/intake.json"
    assert json.loads(server.read_text("utf-8")) == json.loads(web.read_text("utf-8")), "copy the website's file"


VALID: list[tuple[str, Any]] = [
    ("P1", "Ali"),
    ("P2", "2019-05-01"),
    ("P3", "girl"),
    ("P4", None),  # "Not sure"
    ("P8", None),  # an optional question, cleared
    ("P14", ["jumping", "prone"]),
    ("P14", ["nothing"]),
    ("P18", 0),
    ("P18", 2),
    ("P33", ["walk", "hands", "sit"]),
    ("P39", "x" * 1000),
    ("P40", ["clip-1", "clip-2"]),
    ("P41", "+998 90 123 45 67"),
]

REFUSED: list[tuple[str, Any, str]] = [
    ("P3", "dragon", "not_an_option"),  # outside the allowed values
    ("P3", ["boy"], "not_an_option"),
    ("P14", ["jumping", "flying"], "not_an_option"),
    ("P14", ["nothing", "jumping"], "exclusive_option"),
    ("P14", ["jumping", "jumping"], "not_an_option"),
    ("P14", [], "not_a_list"),
    ("P33", ["walk", "hands", "sit", "eat"], "too_many"),
    ("P18", 3, "not_an_option"),
    ("P18", True, "not_an_option"),  # True is not the number 1
    ("P18", "2", "not_an_option"),
    ("P18", None, "answer_required"),  # ability scales have no "Not sure"
    ("P1", None, "answer_required"),  # neither do name and birthday
    ("P2", "2019-13-45", "not_a_date"),
    ("P2", "2099-01-01", "not_a_date"),
    ("P1", "   ", "not_text"),
    ("P1", "x" * 201, "too_long"),
    ("P39", "x" * 1001, "too_long"),
    ("P40", ["a", "b", "c", "d"], "not_clips"),
    ("P41", "12345", "invalid_phone"),
]


@pytest.mark.parametrize(("question", "value"), VALID)
def test_valid_answers(question: str, value: Any) -> None:
    assert problem_with(QUESTIONS[question], value) is None


@pytest.mark.parametrize(("question", "value", "reason"), REFUSED)
def test_answers_outside_the_rules_are_refused(question: str, value: Any, reason: str) -> None:
    with pytest.raises(AppError) as e:
        check_answer(question, value)
    assert (e.value.status, e.value.code) == (422, "invalid_answer")
    assert e.value.extra == {"question": question, "reason": reason}


def test_unknown_question() -> None:
    with pytest.raises(AppError) as e:
        check_answer("P99", "x")
    assert e.value.extra["reason"] == "unknown_question"


def test_follow_up_questions_show_only_after_their_answer() -> None:
    assert not is_shown(QUESTIONS["P10"], {"P9": ["speech_delay"]})
    assert is_shown(QUESTIONS["P10"], {"P9": ["cp", "autism"]})  # multi: contains
    assert is_shown(QUESTIONS["P15_part"], {"P15": "yes"})  # single: equals
    assert not is_shown(QUESTIONS["P15_part"], {"P15": "no"})
    assert is_shown(QUESTIONS["P1"], {})
