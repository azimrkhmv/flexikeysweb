"""A9.2: the assistant chat. The AI never gets the child's name or birth date; Free families have a daily limit."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response

from app.main import app
from app.modules.assistant.ai import FakeAi, get_ai
from app.settings import settings
from tests.test_billing_plan import on_pro
from tests.test_children import API, add_child, parent
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


def test_the_ai_never_gets_the_name_or_birth_date(client: TestClient, ai: FakeAi) -> None:
    owner = parent(client)
    child = add_child(client, owner)  # Ali, born 2019-05-01
    url = f"{API}/children/{child}/assistant/messages"
    first = client.post(url, headers=owner, json={"text": "ALI was born 2019-05-01 and is tired today", "lang": "en"})
    assert first.status_code == 200, first.text
    assert first.json()["answer"].startswith("This is a pretend answer")
    client.post(url, headers=owner, json={"text": "What should Ali do after 01.05.2019?", "lang": "uz"})
    sent = str(ai.sent)
    assert "ali" not in sent.lower().replace("uzbekistan", "") and "2019" not in sent
    assert ("the child" in sent and "7 years old" in sent) or "years old" in sent
    assert len(ai.sent[1]) == 4  # the instructions, the first question and answer, the new question


def test_free_has_a_daily_limit_and_pro_none(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "free_ai_messages_per_day", 2)
    owner = parent(client)
    url = f"{API}/children/{add_child(client, owner)}/assistant/messages"

    def ask() -> Response:
        return client.post(url, headers=owner, json={"text": "How long should we play?", "lang": "ru"})

    assert [ask().json()["remainingToday"] for _ in range(2)] == [1, 0]
    assert title(ask()) == (429, "daily_limit")
    on_pro(client, owner)
    assert ask().json()["remainingToday"] is None


def test_another_family_cannot_ask_about_the_child(client: TestClient) -> None:
    child = add_child(client, parent(client))
    r = client.post(
        f"{API}/children/{child}/assistant/messages", headers=parent(client), json={"text": "Hi", "lang": "en"}
    )
    assert r.status_code == 404
