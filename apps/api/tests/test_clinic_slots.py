"""A10.3: clinic accounts and their free times; a clinic sees only its own places."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

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


def soon(hours: float) -> str:
    return (datetime.now(UTC).replace(microsecond=0) + timedelta(hours=hours)).isoformat()


def clinic_with_place(client: TestClient) -> tuple[dict[str, str], str]:
    _, admin, _ = make(client, Role.admin)
    clinic_id, clinic, _ = make(client, Role.clinic)
    place = client.post(f"{API}/admin/places", headers=admin, json=PLACE | {"clinicId": str(clinic_id)})
    assert place.status_code == 201, place.text
    return clinic, place.json()["id"]


def test_a_clinic_publishes_free_times(client: TestClient) -> None:
    clinic, place = clinic_with_place(client)
    assert [p["id"] for p in client.get(f"{API}/clinic/places", headers=clinic).json()] == [place]
    url = f"{API}/clinic/places/{place}/slots"
    first = client.post(url, headers=clinic, json={"startsAt": soon(24), "minutes": 45, "specialist": "Dr. Aliyeva"})
    assert first.status_code == 201, first.text
    assert (
        client.post(
            url, headers=clinic, json={"startsAt": soon(24.5), "minutes": 30, "specialist": "Dr. Aliyeva"}
        ).status_code
        == 409
    )
    other = {"startsAt": soon(24.5), "minutes": 30, "specialist": "Dr. Karimov", "online": True, "inPerson": False}
    assert client.post(url, headers=clinic, json=other).status_code == 201  # another specialist at the same time
    assert [s["specialist"] for s in client.get(url, headers=clinic).json()] == ["Dr. Aliyeva", "Dr. Karimov"]
    assert title(client.post(url, headers=clinic, json={"startsAt": soon(-1), "minutes": 30})) == (422, "slot_in_past")
    assert title(client.post(url, headers=clinic, json={"startsAt": soon(24 * 120), "minutes": 30})) == (
        422,
        "slot_too_far",
    )
    neither = {"startsAt": soon(48), "minutes": 30, "inPerson": False, "online": False}
    assert title(client.post(url, headers=clinic, json=neither))[0] == 422
    assert client.delete(f"{url}/{first.json()['id']}", headers=clinic).status_code == 204
    assert len(client.get(url, headers=clinic).json()) == 1


def test_a_clinic_sees_only_its_own_data(client: TestClient) -> None:
    clinic, place = clinic_with_place(client)
    slot = client.post(
        f"{API}/clinic/places/{place}/slots", headers=clinic, json={"startsAt": soon(30), "minutes": 30}
    ).json()
    other, _ = clinic_with_place(client)
    assert place not in [p["id"] for p in client.get(f"{API}/clinic/places", headers=other).json()]
    for method, path in [
        ("GET", f"/clinic/places/{place}/slots"),
        ("POST", f"/clinic/places/{place}/slots"),
        ("DELETE", f"/clinic/places/{place}/slots/{slot['id']}"),
    ]:
        body = {"startsAt": soon(40), "minutes": 30} if method == "POST" else None
        assert title(client.request(method, API + path, headers=other, json=body)) == (404, "not_found"), path
    assert title(client.get(f"{API}/clinic/places", headers=parent(client))) == (403, "forbidden")


def test_only_a_clinic_account_can_be_linked(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    physio_id, _, _ = make(client, Role.physio)
    assert title(client.post(f"{API}/admin/places", headers=admin, json=PLACE | {"clinicId": str(physio_id)})) == (
        422,
        "not_a_clinic",
    )
