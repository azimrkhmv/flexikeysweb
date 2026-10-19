"""A13.8: the admin console's lists: people, overview numbers, the audit log and feature flags. Admins only."""

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


def test_only_an_admin_sees_the_lists(client: TestClient) -> None:
    owner = parent(client)
    for path in ("/admin/users", "/admin/overview", "/admin/audit-logs", "/admin/feature-flags"):
        assert title(client.get(f"{API}{path}", headers=owner)) == (403, "forbidden"), path


def test_people_overview_and_audit(client: TestClient) -> None:
    admin_id, admin, _ = make(client, Role.admin)
    physio = client.post(f"{API}/admin/users", headers=admin, json={"phone": "+998977770011", "role": "physio"})
    physio_id = physio.json()["id"] if physio.status_code == 201 else None

    people = client.get(f"{API}/admin/users", headers=admin, params={"limit": 500}).json()
    assert {"id", "phone", "role", "status", "name", "createdAt"} <= set(people[0])
    assert str(admin_id) in [p["id"] for p in people]

    ov = client.get(f"{API}/admin/overview", headers=admin).json()
    assert ov["users"] >= 1 and ov["health"] == {"database": True, "redis": True}
    assert isinstance(ov["aiQuestionsByDay"], dict) and isinstance(ov["sessionsWeek"], int)

    if physio_id:  # the number may exist from an earlier run
        log = client.get(f"{API}/admin/audit-logs", headers=admin, params={"target": physio_id}).json()
        assert [a["action"] for a in log] == ["user.created"] and log[0]["actorId"] == str(admin_id)
    assert client.get(f"{API}/admin/audit-logs", headers=admin, params={"limit": 1}).json()[0]["createdAt"]


def test_feature_flags(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    owner = parent(client)
    assert client.get(f"{API}/flags", headers=owner).json()["ai_assistant"] in (True, False)
    off = client.put(f"{API}/admin/feature-flags", headers=admin, json={"key": "ai_assistant", "enabled": False})
    assert off.json() == {"key": "ai_assistant", "enabled": False, "description": "The parent's assistant chat"}
    assert client.get(f"{API}/flags", headers=owner).json()["ai_assistant"] is False
    listed = {f["key"]: f["enabled"] for f in client.get(f"{API}/admin/feature-flags", headers=admin).json()}
    assert listed["ai_assistant"] is False
    client.put(f"{API}/admin/feature-flags", headers=admin, json={"key": "ai_assistant", "enabled": True})
    assert client.get(f"{API}/flags", headers=owner).json()["ai_assistant"] is True
    unknown = client.put(f"{API}/admin/feature-flags", headers=admin, json={"key": "nope", "enabled": True})
    assert title(unknown) == (404, "not_found")
