"""A10.1: places for Find help; an admin adds and edits them, with every field the spec lists (§11)."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from tests.test_admin_changes import audit_for, make
from tests.test_children import API, parent
from tests.test_videos_register import title

PLACE: dict[str, Any] = {
    "name": "Respublika bolalar reabilitatsiya markazi",
    "kind": "state_centre",
    "region": "tashkent_city",
    "district": "Chilonzor",
    "address": "Bunyodkor 1",
    "mapUrl": "https://maps.example/1",
    "lat": "41.285",
    "lng": "69.204",
    "phone": "+998 71 200 00 00",
    "telegram": "@markaz",
    "languages": ["uz", "ru"],
    "needs": ["movement", "speech"],
    "ageMin": 0,
    "ageMax": 18,
    "worksWithCp": True,
    "checkedAt": "2026-10-01",
}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_an_admin_adds_and_edits_a_place(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    added = client.post(f"{API}/admin/places", headers=admin, json=PLACE)
    assert added.status_code == 201, added.text
    place = added.json()
    # Every field of the spec: name, type, district, map link, contacts, languages, ages, CP, prices, date checked.
    for field in (
        "name",
        "kind",
        "district",
        "mapUrl",
        "phone",
        "languages",
        "ageMin",
        "ageMax",
        "worksWithCp",
        "priceMin",
        "priceMax",
        "checkedAt",
    ):
        assert field in place
    assert place["phone"] == "+998712000000" and place["priceMin"] is None and place["active"] is True

    changed = client.patch(
        f"{API}/admin/places/{place['id']}",
        headers=admin,
        json={"kind": "private_clinic", "priceMin": 150000, "priceMax": 250000},
    )
    assert changed.status_code == 200 and (changed.json()["kind"], changed.json()["priceMax"]) == (
        "private_clinic",
        250000,
    )
    assert (
        client.patch(f"{API}/admin/places/{place['id']}", headers=admin, json={"active": False}).json()["active"]
        is False
    )
    assert any(p["id"] == place["id"] for p in client.get(f"{API}/admin/places", headers=admin).json())  # hidden too
    assert [a for a, _, _ in audit_for(client, uuid.UUID(place["id"]))][:2] == ["place.created", "place.changed"]


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"district": "Nowhere"}, "invalid_district"),
        ({"ageMin": 10, "ageMax": 3}, "invalid_ages"),
        ({"priceMin": 9, "priceMax": 1}, "invalid_prices"),
        ({"phone": "12"}, "invalid_phone"),
        ({"name": None}, "invalid_place"),
        ({"mapUrl": "javascript:alert(1)"}, "validation_error"),
        ({"needs": []}, "validation_error"),
    ],
)
def test_wrong_places_are_refused(client: TestClient, change: dict[str, Any], code: str) -> None:
    _, admin, _ = make(client, Role.admin)
    place = client.post(f"{API}/admin/places", headers=admin, json=PLACE).json()
    assert title(client.patch(f"{API}/admin/places/{place['id']}", headers=admin, json=change))[1] == code


def test_only_admins_manage_places(client: TestClient) -> None:
    owner = parent(client)
    assert title(client.post(f"{API}/admin/places", headers=owner, json=PLACE)) == (403, "forbidden")
    assert title(client.get(f"{API}/admin/places", headers=owner)) == (403, "forbidden")
