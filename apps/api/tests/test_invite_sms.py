"""A8.8 (G9): a phone invite sends the therapist one SMS with the sign-in link; a link invite sends none."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.sms import get_sms
from app.settings import settings
from tests.test_therapists import new_phone, shared_child
from tests.test_visit_reminders import Outbox

API = "/api/v1"


@pytest.fixture
def outbox() -> Iterator[Outbox]:
    box = Outbox()
    app.dependency_overrides[get_sms] = lambda: box
    yield box
    app.dependency_overrides.pop(get_sms)


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_a_phone_invite_texts_the_therapist_once(client: TestClient, outbox: Outbox) -> None:
    owner, child = shared_child(client)
    outbox.sent.clear()  # the owner's sign-in code
    phone = new_phone()
    assert client.post(f"{API}/children/{child}/therapists", headers=owner, json={"phone": phone}).status_code == 201
    ((to, text),) = outbox.sent
    assert to == phone and f"{settings.site_url}/login" in text
    assert "Ali" not in text  # no child's name in an SMS

    client.post(f"{API}/children/{child}/therapists", headers=owner, json={"phone": phone})  # 409 already_invited
    assert len(outbox.sent) == 1
    link = client.post(f"{API}/children/{child}/therapists", headers=owner, json={})
    assert link.status_code == 201 and link.json()["code"]
    assert len(outbox.sent) == 1  # a link invite: the parent passes the link on
