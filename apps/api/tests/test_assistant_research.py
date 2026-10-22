# ruff: noqa: F811, RUF001  (pytest fixtures as arguments; the made-up library uses real dashes)
"""A9.8: the assistant answers only from the research library: the AI gets only the entries that match, its answer
names the papers, and with no matching entry the assistant says it does not know. The library here is made up; the
real knowledge base is kept outside the repository."""

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.modules.accounts.models import Lang
from app.modules.assistant import research
from app.modules.assistant.ai import FakeAi
from app.settings import settings
from tests.test_assistant_chat import ai, client  # noqa: F401
from tests.test_children import API, add_child, parent
from tests.test_therapist_form import share

KB = """# Made-up knowledge base

## 1. Hands

### KB-HAND-01 — Two-hand play

**Tags:** CP · MACS I–III · ages 2+

**For families:** Play games that need both hands, like opening a box.

**Clinical notes:** Bimanual training, 30 minutes a day.

**Evidence:** \\[S1\\], \\[S2\\]

### KB-TECH-02 — Apps in research

**Tags:** team and investor reference · not for parents

**Clinical notes:** Few app studies, all low quality.

**Evidence:** \\[S2\\]

## 8. Massage

### KB-MAS-01 — Massage

**Tags:** all

**For families:** Massage relaxes muscles.

**Evidence:** \\[S1\\]

## 9. Safety

### KB-SAFE-01 — Stop signs

**Tags:** all

**For families:** Stop if your child has pain.

**Evidence:** Team protocol (pending physio sign-off)

## Sources

| ID | Paper | Year | PMID |
| --- | --- | --- | --- |
| S1 | Novak et al. — [Traffic lights](https://doi.org/x) | 2020 | 1 |
| S2 | Hoare et al. — [Bimanual review](https://doi.org/y) | 2019 | 2 |
"""


@pytest.fixture
def library(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    (tmp_path / "kb.md").write_text(KB, "utf-8")
    monkeypatch.setattr(settings, "research_path", str(tmp_path))  # a folder of Markdown files
    yield
    research.library.cache_clear()


def pick(*ids: str, plan: bool = False) -> str:
    return "```json\n" + json.dumps({"entries": list(ids), "plan": plan}) + "\n```"


def ask(client: TestClient, text: str = "How can my child use both hands?", lang: str = "en") -> str:
    owner = parent(client)
    r = client.post(f"{API}/children/{add_child(client, owner)}/assistant/messages", headers=owner,
                    json={"text": text, "lang": lang})  # fmt: skip
    assert r.status_code == 200, r.text
    return str(r.json()["answer"])


def test_the_library_is_read_from_the_knowledge_base(library: None) -> None:
    entries = research.library(settings.research_path)
    assert set(entries) == {"KB-HAND-01", "KB-TECH-02", "KB-SAFE-01"}  # massage is a later feature (FA7)
    assert entries["KB-HAND-01"].sources == ("Novak et al., 2020", "Hoare et al., 2019")
    assert entries["KB-HAND-01"].tags == "CP · MACS I–III · ages 2+"
    assert entries["KB-SAFE-01"].sources == ("Team protocol (pending physio sign-off)",)
    assert "KB-TECH-02" not in research.for_asker(entries, therapist=False)  # "not for parents"


def test_an_answer_uses_only_the_matching_passage_and_names_its_papers(
    library: None,
    client: TestClient,
    ai: FakeAi,
) -> None:
    ai.replies = [pick("KB-HAND-01", "KB-NOPE-09"), "Open a box together, using both hands [KB-HAND-01]."]
    answer = ask(client)
    assert answer == "Open a box together, using both hands.\n\nSource: Novak et al., 2020; Hoare et al., 2019"
    finder, answerer = ai.sent
    assert "KB-TECH-02" not in str(finder)  # a parent's question: entries "not for parents" are not offered
    assert "Play games that need both hands" in answerer[0]["content"]
    assert "Stop if your child has pain" not in answerer[0]["content"]  # only the matching passage


def test_with_no_matching_passage_it_does_not_know(library: None, client: TestClient, ai: FakeAi) -> None:
    ai.replies = [pick()]
    assert ask(client, "Kakoy vrach luchshe?", "ru") == research.NO_SOURCE[Lang.ru]
    assert len(ai.sent) == 1  # no second AI call


@pytest.mark.parametrize("answer", ["Open a box together.", "Open a box [KB-SAFE-01].", "Open a box [KB-MAS-01]."])
def test_an_answer_without_a_given_source_is_not_shown(
    answer: str,
    library: None,
    client: TestClient,
    ai: FakeAi,
) -> None:
    ai.replies = [pick("KB-HAND-01"), answer]
    assert ask(client) == research.NO_SOURCE[Lang.en]


def test_a_question_about_the_plan_is_answered_from_the_plan(
    library: None,
    client: TestClient,
    ai: FakeAi,
) -> None:
    ai.replies = [pick(plan=True), "Today there is no task in the plan."]
    assert ask(client, "What do we do today?") == "Today there is no task in the plan."
    assert "Answer only about the child's plan" in ai.sent[1][0]["content"]


def test_a_therapist_may_get_entries_not_for_parents(library: None, client: TestClient, ai: FakeAi) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    therapist = share(client, owner, child)
    ai.replies = [pick("KB-TECH-02"), "Few studies exist [KB-TECH-02]."]
    r = client.post(f"{API}/children/{child}/assistant/messages", headers=therapist,
                    json={"text": "Is there research on apps?", "lang": "en"})  # fmt: skip
    assert r.json()["answer"] == "Few studies exist.\n\nSource: Hoare et al., 2019"
