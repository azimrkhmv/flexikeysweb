"""A10.2: parents search places, free state centres first, then by distance; a report flags the place."""

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from tests.test_admin_changes import make
from tests.test_children import API, parent
from tests.test_places_admin import PLACE
from tests.test_videos_register import title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def add(client: TestClient, admin: dict[str, str], **change: Any) -> str:
    r = client.post(f"{API}/admin/places", headers=admin, json=PLACE | change)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def test_free_centres_first_then_by_distance(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    far = add(
        client, admin, kind="private_clinic", name="Far", lat="41.40", lng="69.40", priceMin=100000, priceMax=200000
    )
    near = add(client, admin, kind="private_clinic", name="Near", lat="41.30", lng="69.21")
    state = add(client, admin, kind="state_centre", name="State", lat="41.45", lng="69.50")
    hidden = add(client, admin, kind="private_clinic", name="Closed", active=False)
    speech_only = add(client, admin, kind="private_clinic", name="Speech", needs=["speech"])
    owner = parent(client)

    found = client.get(f"{API}/places", headers=owner, params={"need": "movement", "lat": 41.29, "lng": 69.20}).json()
    mine = [p["id"] for p in found if p["id"] in {far, near, state, hidden, speech_only}]
    assert mine == [state, near, far]  # the free centre first, then the nearest; no hidden one, no other need
    assert next(p for p in found if p["id"] == near)["distanceKm"] < 2
    assert next(p for p in found if p["id"] == near)["lat"] == 41.3  # the website sorts by distance itself too
    assert speech_only in [p["id"] for p in client.get(f"{API}/places", headers=owner).json()]  # no need: all


def test_an_old_price_says_not_recently_checked(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    old = add(client, admin, name="Old", checkedAt="2025-01-01", priceMin=1, priceMax=2)
    new = add(client, admin, name="New", checkedAt=date.today().isoformat())
    found = {p["id"]: p for p in client.get(f"{API}/places", headers=parent(client)).json()}
    assert (found[old]["priceNotRecentlyChecked"], found[new]["priceNotRecentlyChecked"]) == (True, False)


def test_a_report_flags_the_place_until_it_is_checked_again(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    place = add(client, admin, name="Reported")
    owner = parent(client)
    url = f"{API}/places/{place}/reports"
    assert client.post(url, headers=owner, json={"reason": "closed"}).status_code == 204
    assert client.post(url, headers=owner, json={"reason": "closed"}).status_code == 204  # again: nothing new
    seen = {p["id"]: p["reported"] for p in client.get(f"{API}/places", headers=owner).json()}
    assert seen[place] is True  # the parent sees their report was sent; another parent does not
    assert {p["id"]: p["reported"] for p in client.get(f"{API}/places", headers=parent(client)).json()}[place] is False
    listed = client.get(f"{API}/admin/places", headers=admin).json()
    assert listed[0]["flaggedAt"] is not None  # flagged places come first for our team
    assert next(p for p in listed if p["id"] == place)["flaggedAt"] is not None
    checked = client.patch(f"{API}/admin/places/{place}", headers=admin, json={"checkedAt": date.today().isoformat()})
    assert checked.json()["flaggedAt"] is None
    assert title(client.post(f"{API}/places/{place}/reports", headers=owner, json={"reason": "nope"}))[0] == 422
