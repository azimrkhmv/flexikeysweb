"""A10.4: booking, confirm and cancel, in person or online; the database makes a double booking impossible."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.modules.places.models import Booking, BookingMode
from tests.test_children import API, add_child, parent
from tests.test_clinic_slots import clinic_with_place, soon
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def published(client: TestClient, **extra: Any) -> tuple[dict[str, str], str, str]:
    clinic, place = clinic_with_place(client)
    body = {"startsAt": soon(26), "minutes": 30, **extra}
    slot = client.post(f"{API}/clinic/places/{place}/slots", headers=clinic, json=body).json()
    return clinic, place, slot["id"]


def test_book_confirm_and_cancel(client: TestClient) -> None:
    clinic, place, slot = published(client, online=True)
    owner = parent(client)
    child = add_child(client, owner)
    assert [s["id"] for s in client.get(f"{API}/places/{place}/slots", headers=owner).json()] == [slot]
    booked = client.post(f"{API}/children/{child}/bookings", headers=owner, json={"slotId": slot, "mode": "online"})
    assert booked.status_code == 201, booked.text
    b = booked.json()
    assert (b["status"], b["placeId"], b["slotId"]) == ("booked", place, slot)
    assert client.get(f"{API}/places/{place}/slots", headers=owner).json() == []  # taken: no longer listed

    other = parent(client)
    second = client.post(
        f"{API}/children/{add_child(client, other)}/bookings", headers=other, json={"slotId": slot, "mode": "online"}
    )
    assert title(second) == (409, "slot_taken")

    seen = client.get(f"{API}/clinic/places/{place}/bookings", headers=clinic).json()
    assert [(x["childName"], x["status"]) for x in seen] == [("Ali", "booked")] and seen[0]["parentPhone"]
    confirm = f"{API}/clinic/bookings/{b['id']}/confirm"
    assert title(client.post(confirm, headers=clinic, json={})) == (422, "online_link_needed")
    ok = client.post(confirm, headers=clinic, json={"onlineLink": "https://meet.example/x"}).json()
    assert (ok["status"], ok["onlineLink"]) == ("confirmed", "https://meet.example/x")
    assert title(client.delete(f"{API}/clinic/places/{place}/slots/{slot}", headers=clinic)) == (409, "slot_booked")

    cancelled = client.post(f"{API}/children/{child}/bookings/{b['id']}/cancel", headers=owner).json()
    assert (cancelled["status"], cancelled["cancelledBy"]) == ("cancelled", "family")
    assert [s["id"] for s in client.get(f"{API}/places/{place}/slots", headers=owner).json()] == [slot]  # free again
    again = client.post(f"{API}/children/{child}/bookings", headers=owner, json={"slotId": slot, "mode": "online"})
    assert again.status_code == 201


def test_the_database_refuses_a_second_booking(client: TestClient) -> None:
    _, _, slot = published(client)
    owner = parent(client)
    child = uuid.UUID(add_child(client, owner))

    async def twice(db: Any) -> None:
        db.add(Booking(slot_id=uuid.UUID(slot), child_id=child, mode=BookingMode.in_person))
        await db.flush()
        db.add(Booking(slot_id=uuid.UUID(slot), child_id=child, mode=BookingMode.in_person))
        await db.flush()

    with pytest.raises(IntegrityError):
        run(client, twice)


def test_modes_and_other_clinics(client: TestClient) -> None:
    clinic, _, slot = published(client)  # in person only
    owner = parent(client)
    child = add_child(client, owner)
    url = f"{API}/children/{child}/bookings"
    assert title(client.post(url, headers=owner, json={"slotId": slot, "mode": "online"})) == (422, "mode_not_offered")
    assert title(client.post(url, headers=owner, json={"slotId": str(uuid.uuid4()), "mode": "in_person"})) == (
        422,
        "slot_gone",
    )
    b = client.post(url, headers=owner, json={"slotId": slot, "mode": "in_person"}).json()
    stranger, _ = clinic_with_place(client)
    assert title(client.post(f"{API}/clinic/bookings/{b['id']}/confirm", headers=stranger, json={})) == (
        404,
        "not_found",
    )
    assert title(client.post(f"{API}/clinic/bookings/{b['id']}/cancel", headers=stranger)) == (404, "not_found")
    done = client.post(f"{API}/clinic/bookings/{b['id']}/cancel", headers=clinic).json()
    assert (done["status"], done["cancelledBy"]) == ("cancelled", "clinic")
    assert [x["status"] for x in client.get(url, headers=owner).json()] == ["cancelled"]
