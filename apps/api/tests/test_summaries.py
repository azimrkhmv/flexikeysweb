"""A9.5: the weekly summary and the plan explanation keep to the facts they were given."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.assistant.ai import FakeAi, get_ai
from app.modules.assistant.summaries import WeekFacts, only_given
from app.settings import settings
from tests.test_children import API, add_child, parent
from tests.test_free_limits import free_family_with_plan
from tests.test_videos_register import title


@pytest.fixture
def ai() -> Iterator[FakeAi]:
    fake = FakeAi()
    app.dependency_overrides[get_ai] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_ai)


@pytest.fixture
def client(ai: FakeAi) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


FACTS = WeekFacts(days_with_tasks=3, exercises_done=5, games_done=2, felt_easy=1, felt_ok=1, felt_hard=0, days_paused=1)


def test_only_given_facts_pass() -> None:
    assert only_given("Your child practised on 3 of 7 days and did 5 exercises. Well done.", FACTS)
    assert not only_given("Your child did 6 exercises.", FACTS)  # 6 was not given
    assert not only_given("Your child is 30% better.", FACTS)  # a percentage, and 30 was not given
    assert not only_given("One. Two. Three. Four.", FACTS)  # more than three sentences
    assert not only_given("", FACTS)


def test_weekly_summary_uses_the_ai_only_when_it_keeps_to_the_facts(client: TestClient, ai: FakeAi) -> None:
    owner, child = free_family_with_plan(client)
    url = f"{API}/children/{child}/weekly-summary"
    ai.answer = "This week your child did tasks on 0 of 7 days. Rest is fine too."
    r = client.get(url, headers=owner, params={"lang": "en"}).json()
    assert (r["writtenBy"], r["text"]) == ("ai", ai.answer)
    assert r["facts"]["daysWithTasks"] == 0
    prompt = str(ai.sent)
    assert "Ali" not in prompt and "2019" not in prompt  # the child's name and birth date are never sent

    ai.answer = "Your child improved by 40% this week."  # a fact nobody gave
    r = client.get(url, headers=owner, params={"lang": "ru"}).json()
    assert r["writtenBy"] == "template" and "40" not in r["text"]
    assert client.get(url, headers=owner, params={"lang": "en"}).json()["text"].startswith("This week")  # kept
    assert len(ai.sent) == 2  # the English text came from the store, the AI was not asked again


def test_plan_explanation(client: TestClient, ai: FakeAi) -> None:
    owner, child = free_family_with_plan(client)
    url = f"{API}/children/{child}/plan-explanation"
    ai.answer = "The plan has 99 exercises."
    r = client.get(url, headers=owner, params={"lang": "uz"}).json()
    assert r["writtenBy"] == "template" and r["facts"]["goals"]
    assert title(client.get(f"{API}/children/{add_child(client, owner)}/plan-explanation", headers=owner,
                            params={"lang": "en"})) == (404, "no_plan")  # fmt: skip
    assert client.get(url, headers=parent(client), params={"lang": "en"}).status_code == 404  # another family


def test_over_the_monthly_limit_the_fixed_sentence(
    client: TestClient, ai: FakeAi, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ai_monthly_limit_usd", 0.0)
    owner, child = free_family_with_plan(client)
    r = client.get(f"{API}/children/{child}/weekly-summary", headers=owner, params={"lang": "en"}).json()
    assert r["writtenBy"] == "template" and ai.sent == []
