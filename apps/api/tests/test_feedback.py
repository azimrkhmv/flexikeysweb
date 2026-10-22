"""The pilot's feedback box: anyone signed in sends a message; only admins read them."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from tests.test_admin_changes import make
from tests.test_children import API, parent
from tests.test_videos_register import title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_a_parent_sends_feedback_and_an_admin_reads_it(client: TestClient) -> None:
    owner = parent(client)
    sent = client.post(
        f"{API}/feedback",
        headers=owner,
        json={"text": "  The walking questions were long  ", "page": "/parent/children/new"},
    )
    assert sent.status_code == 204
    assert title(client.post(f"{API}/feedback", headers=owner, json={"text": ""})) == (422, "validation_error")
    assert client.get(f"{API}/admin/feedback", headers=owner).status_code == 403
    _, admin, _ = make(client, Role.admin)
    got = client.get(f"{API}/admin/feedback", headers=admin).json()
    assert [(f["text"], f["page"]) for f in got][:1] == [("The walking questions were long", "/parent/children/new")]
    assert client.post(f"{API}/feedback", json={"text": "hi"}).status_code == 401
