"""A2.5: health answers are encrypted. A raw copy of the database does not show them."""

import uuid
from collections.abc import Iterator

import pytest
from cryptography.fernet import Fernet, MultiFernet
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import crypto
from app.db import SessionLocal
from app.main import app
from tests.test_children import add_child, parent
from tests.test_intake_save import health_consent, save, saved

HEALTH = {"P14": ["jumping", "prone"], "P9": ["cp", "autism"], "P14_other": "no swimming pool"}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def raw_rows(client: TestClient, child: str) -> str:
    """Every stored answer row of the child, as the database itself holds it (what a stolen copy would show)."""

    async def run() -> str:
        async with SessionLocal() as db:
            rows = await db.execute(
                text(
                    "select row_to_json(a)::text from intake_answers a join intake_rounds r on r.id = a.round_id "
                    "where r.child_id = :c"
                ),
                {"c": uuid.UUID(child)},
            )
            return "\n".join(row[0] for row in rows)

    return client.portal.call(run)  # type: ignore[union-attr]


def test_health_answers_are_unreadable_in_the_database(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    assert save(client, owner, child, HEALTH | {"P1": "Ali"}).status_code == 200

    dump = raw_rows(client, child)
    for secret_word in ("jumping", "prone", "autism", "swimming"):
        assert secret_word not in dump
    assert '"P14"' in dump and '"Ali"' in dump  # the rows are there; only the health values are hidden

    assert saved(client, owner, child) == HEALTH | {"P1": "Ali"}  # the family reads them normally


def test_not_sure_on_a_health_question_stays_empty(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    save(client, owner, child, {"P15": None})
    row = raw_rows(client, child)
    assert '"value":null' in row and '"secret":null' in row
    assert saved(client, owner, child) == {"P15": None}


def test_same_answer_never_looks_the_same_twice() -> None:
    assert crypto.encrypt_json(["jumping"]) != crypto.encrypt_json(["jumping"])


def test_a_new_key_still_reads_old_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    old = crypto.encrypt_json({"P14": ["jumping"]})
    rotated = MultiFernet([Fernet(Fernet.generate_key()), *crypto._fernet._fernets])  # new key first
    monkeypatch.setattr(crypto, "_fernet", rotated)
    assert crypto.decrypt_json(old) == {"P14": ["jumping"]}


def test_wrong_key_cannot_read(monkeypatch: pytest.MonkeyPatch) -> None:
    token = crypto.encrypt_json(["jumping"])
    monkeypatch.setattr(crypto, "_fernet", MultiFernet([Fernet(Fernet.generate_key())]))
    with pytest.raises(RuntimeError, match="cannot be decrypted"):
        crypto.decrypt_json(token)
