"""A5.5: one daily question a day; the answer updates the child's profile (the next question round starts from it)."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.intake.rules import QUESTIONS
from app.modules.today.router import DAILY, load_daily_questions
from tests.test_children import API, add_child, add_helper, parent
from tests.test_intake_rounds import complete, finish, next_round, three_months_pass
from tests.test_intake_save import save
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def loaded(client: TestClient) -> None:
    run(client, load_daily_questions)


def test_the_list_matches_the_website_and_never_asks_about_health() -> None:
    web = Path(__file__).parents[2] / "web/src/content/backend/daily.json"
    if web.exists():
        assert json.loads(DAILY.read_text("utf-8")) == json.loads(web.read_text("utf-8")), "copy the website's file"
    for q in json.loads(DAILY.read_text("utf-8")):
        assert QUESTIONS[q["updates"]].kind == "ability" and not QUESTIONS[q["updates"]].health


def test_loading_twice_changes_nothing(client: TestClient) -> None:
    assert run(client, load_daily_questions) == 8
    assert run(client, load_daily_questions) == 8


def daily(client: TestClient, who: dict[str, str], child: str) -> Any:
    return client.get(f"{API}/children/{child}/daily", headers=who)


def answer(client: TestClient, who: dict[str, str], child: str, qid: str, value: int) -> Any:
    return client.put(f"{API}/children/{child}/daily", headers=who, json={"questionId": qid, "value": value})


def test_one_question_a_day_and_the_answer_is_saved(client: TestClient, loaded: None) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    q = daily(client, owner, child).json()
    assert (
        q["answer"] is None and q["text"]["en"].startswith("Today") and [o["value"] for o in q["options"]] == [2, 1, 0]
    )
    assert daily(client, helper, child).json()["questionId"] == q["questionId"]  # the same question for the family
    assert answer(client, owner, child, q["questionId"], 1).status_code == 204
    assert answer(client, helper, child, q["questionId"], 2).status_code == 204  # changed the same day
    assert daily(client, owner, child).json()["answer"] == 2
    other = "D1" if q["questionId"] != "D1" else "D2"
    assert title(answer(client, owner, child, other, 2)) == (409, "not_todays_question")
    assert title(answer(client, owner, child, q["questionId"], 5)) == (422, "invalid_answer")
    assert title(daily(client, parent(client), child)) == (404, "not_found")


def test_the_answer_updates_the_profile(client: TestClient, loaded: None) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert save(client, owner, child, complete(with_health=False)).status_code == 200
    assert finish(client, owner, child).status_code == 200
    three_months_pass(client, child)
    q = daily(client, owner, child).json()
    updates = next(d["updates"] for d in json.loads(DAILY.read_text("utf-8")) if d["id"] == q["questionId"])
    assert complete(with_health=False)[updates] == 1
    assert answer(client, owner, child, q["questionId"], 2).status_code == 204
    r = next_round(client, owner, child)
    assert r.status_code == 201, r.text
    assert r.json()["answers"][updates] == 2  # the new round starts from the daily answer
