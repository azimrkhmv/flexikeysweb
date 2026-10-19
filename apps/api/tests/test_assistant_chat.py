"""A9.2, A9.3: the assistant chat. The AI never gets the child's name or birth date; Free families have a daily
limit; emergency words get 103 first; an answer never suggests what the child must avoid."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response

from app.main import app
from app.modules.assistant.ai import FakeAi, get_ai
from app.modules.assistant.safety import is_emergency
from app.settings import settings
from tests.test_billing_plan import on_pro
from tests.test_children import API, add_child, parent
from tests.test_therapist_form import share
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


# A9.3: emergency words, in each of the four languages, get 103 before any limit or AI call.
EMERGENCIES = {
    "en": "He had a seizure ten minutes ago",
    "ru": "У ребёнка судороги, что делать?",
    "uz": "Bolada tutqanoq boʻldi",
    "uz_cyrl": "Болада тутқаноқ бўлди",
}


@pytest.mark.parametrize("lang", EMERGENCIES)
def test_emergency_words_get_103_first(
    lang: str, client: TestClient, ai: FakeAi, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "free_ai_messages_per_day", 0)  # even with no messages left today
    owner = parent(client)
    r = client.post(
        f"{API}/children/{add_child(client, owner)}/assistant/messages",
        headers=owner,
        json={"text": EMERGENCIES[lang], "lang": lang},
    ).json()
    assert r["emergency"] is True and "103" in r["answer"]
    assert ai.sent == []  # no AI call


def test_emergency_words() -> None:
    for text in (
        "He fell and hit his head",
        "она не дышит",
        "nafas ololmayapti",
        "кучли оғрияпти",
        "boshini urib oldi",
    ):
        assert is_emergency(text), text
    for text in ("Приступайте к упражнению", "How long should we play?", "Qachon mashq qilamiz?"):
        assert not is_emergency(text), text


def test_an_answer_with_a_forbidden_movement_is_replaced(client: TestClient, ai: FakeAi) -> None:
    owner = parent(client)
    url = f"{API}/children/{add_child(client, owner)}/assistant/messages"  # no answers yet: every cautious restriction
    ai.answer = "Try jumping on a soft mat for five minutes."
    r = client.post(url, headers=owner, json={"text": "What can we do for the legs?", "lang": "en"}).json()
    assert r["answer"].startswith("I can't suggest that") and r["emergency"] is False
    assert "jumping" in ai.sent[0][0]["content"]  # the AI was told what to avoid
    ai.answer = "Squeeze the putty ten times with each hand."
    r = client.post(url, headers=owner, json={"text": "And for the hands?", "lang": "en"}).json()
    assert r["answer"] == ai.answer


# A9.4: the chat is kept until deleted; the therapist gets topics and warnings only, never the chat.
def test_the_chat_is_kept_until_deleted(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    url = f"{API}/children/{child}/assistant/messages"
    client.post(url, headers=owner, json={"text": "How do we do the putty exercise?", "lang": "en"})
    chat = client.get(url, headers=owner).json()
    assert [(m["speaker"], m["text"][:10]) for m in chat] == [("adult", "How do we "), ("assistant", "This is a ")]
    assert client.get(url, headers=parent(client)).status_code == 404  # another family
    assert client.delete(url, headers=owner).status_code == 204
    assert client.get(url, headers=owner).json() == []

    client.post(url, headers=owner, json={"text": "Again", "lang": "en"})
    me = client.get(f"{API}/me", headers=owner).json()["id"]
    assert client.delete(f"{API}/children/{child}/chats/{me}", headers=owner).status_code == 204  # the owner
    assert client.get(url, headers=owner).json() == []


def test_the_therapist_sees_topics_and_warnings_never_the_chat(client: TestClient, ai: FakeAi) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    therapist = share(client, owner, child)
    url = f"{API}/children/{child}/assistant/messages"
    for text in ("How do we do the putty exercise?", "He is tired and refuses the exercise", "У него судороги"):
        client.post(url, headers=owner, json={"text": text, "lang": "en"})
    ai.answer = "Let him jump on the bed."  # replaced: a warning
    client.post(url, headers=owner, json={"text": "Something fun for today?", "lang": "en"})

    r = client.get(f"{API}/therapist/children/{child}/assistant-summary", headers=therapist)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["questions"] == 4
    assert {t["topic"]: t["count"] for t in s["topics"]}["exercise"] == 2
    assert sorted(w["kind"] for w in s["warnings"]) == ["emergency", "restricted"]
    assert "putty" not in r.text and "jump" not in r.text  # never the words of the chat
    assert client.get(f"{API}/therapist/children/{child}/assistant-summary", headers=parent(client)).status_code in (
        403,
        404,
    )


# A9.6: past the month's AI money the assistant gives fixed answers; emergencies still get 103.
def test_over_the_monthly_limit_fixed_answers(client: TestClient, ai: FakeAi, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_monthly_limit_usd", 0.0)
    owner = parent(client)
    child = add_child(client, owner)
    url = f"{API}/children/{child}/assistant/messages"
    r = client.post(url, headers=owner, json={"text": "How long should we play?", "lang": "en"}).json()
    assert r["answer"].startswith("The assistant has used its time for this month") and ai.sent == []
    r = client.post(url, headers=owner, json={"text": "Он не дышит", "lang": "ru"}).json()
    assert r["emergency"] is True and "103" in r["answer"]
