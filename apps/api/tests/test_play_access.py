"""A6.4: the child's access settings; values outside the spec's ranges are refused."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_children import API, add_child, add_helper, parent
from tests.test_videos_register import title

GOOD = {"inputMode": "dwell", "minTargetMm": 26, "dwellMs": 1200, "repeatLock": True, "releaseOk": False}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def put(client: TestClient, who: dict[str, str], child: str, body: dict[str, Any]) -> Any:
    return client.put(f"{API}/children/{child}/access", headers=who, json=body)


def test_saved_and_read_by_the_family(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert title(client.get(f"{API}/children/{child}/access", headers=owner)) == (404, "no_access_settings")
    assert put(client, owner, child, GOOD).json() == GOOD
    helper = add_helper(client, owner)
    changed = {**GOOD, "inputMode": "switch"}
    assert put(client, helper, child, changed).status_code == 200  # saved again, not added twice
    assert client.get(f"{API}/children/{child}/access", headers=owner).json() == changed


@pytest.mark.parametrize(
    ("field", "value"),
    [("minTargetMm", 11), ("dwellMs", 499), ("dwellMs", 3001), ("inputMode", "eyes"), ("repeatLock", None)],
)
def test_values_outside_the_spec_are_refused(client: TestClient, field: str, value: Any) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert title(put(client, owner, child, {**GOOD, field: value})) == (422, "validation_error")


def test_another_family_cannot(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert title(put(client, parent(client), child, GOOD)) == (404, "not_found")
