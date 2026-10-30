"""IQ1: the server shows each sample child exactly the questions the website shows (questionnaire_cases.json, a copy
of apps/web/src/content/backend/questionnaire_cases.json made by questionnaire.test.ts)."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.modules.intake.questionnaire import DATA, QUESTIONS, shown_options, visible

CASES: list[dict[str, Any]] = json.loads((Path(__file__).parent / "questionnaire_cases.json").read_text("utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_server_shows_what_the_website_shows(case: dict[str, Any]) -> None:
    today = date.fromisoformat(case["today"])
    assert visible(case["answers"], today) == case["visible"]
    for qid, options in case["options"].items():
        assert shown_options(qid, case["answers"], today) == options, qid


def test_every_numbered_question_of_the_questionnaire_is_there() -> None:
    sections = {"A": 10, "B": 13, "C": 25, "D": 13, "E": 13, "F": 11, "G": 10, "H": 8, "I": 9, "J": 11, "L": 9,
                "CP": 21, "DCD": 12, "DD": 6, "DS": 7, "AU": 8}  # fmt: skip
    moved = {"B2", "B9", "B12"}  # moved into the CP module (CP1, CP3, CP4); numbers are never reused
    moved |= {"B3"}  # retired 30 Oct 2026: B3_parts replaces it (B61)
    for prefix, last in sections.items():
        for n in range(1, last + 1):
            qid = f"{prefix}{n}"
            assert qid in QUESTIONS or qid in moved, qid
    assert DATA["version"] == "2026-10-30"  # Bekzod's parent review (B60)
