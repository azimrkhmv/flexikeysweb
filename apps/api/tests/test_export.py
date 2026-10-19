"""A12.1: the owner downloads everything stored about a child; the file holds every table about the child."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import app
from app.modules.privacy.router import child_tables
from tests.test_children import API, add_child, add_helper, parent
from tests.test_intake_save import health_consent, save
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_the_file_holds_everything_about_the_child(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    assert save(client, owner, child, {"P1": "Ali", "P12": "walker", "P14": ["jumping"]}).status_code == 200
    client.post(
        f"{API}/children/{child}/voice-cards", headers=owner, json={"category": "food", "label": "Non", "emoji": "🍞"}
    )

    got = client.get(f"{API}/children/{child}/export", headers=owner)
    assert got.status_code == 200
    assert got.headers["content-disposition"].startswith('attachment; filename="flexikeys-Ali-')
    data = got.json()
    assert data["child"]["name"] == "Ali"
    assert set(data["tables"]) == {t.name for t, _ in child_tables()}  # every table about a child

    answers = {a["question_id"]: a for a in data["tables"]["intake_answers"]}
    assert answers["P12"]["decrypted"] == "walker"  # a health answer, readable for the parent
    assert [c["label"] for c in data["tables"]["voice_cards"]] == ["Non"]

    async def counts(db: Any) -> dict[str, int]:
        out = {}
        for table, parent_table in child_tables():
            if parent_table is None:
                out[table.name] = await db.scalar(
                    select(func.count()).select_from(table).where(table.c.child_id == uuid.UUID(child))
                )
        return out

    for name, n in run(client, counts).items():  # every row, not only some
        assert len(data["tables"][name]) == n, name


def test_only_the_owner_downloads(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    assert title(client.get(f"{API}/children/{child}/export", headers=helper)) == (403, "owner_only")
