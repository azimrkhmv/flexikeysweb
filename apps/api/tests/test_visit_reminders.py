"""A10.5: visit reminders 1 day and 2 hours before, each once, never for a cancelled visit; the worker runs them
every 5 minutes."""

import uuid
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.places import reminders
from app.modules.places.models import Booking
from app.worker import WorkerSettings, remind_visits
from tests.test_bookings import published
from tests.test_children import API, add_child, parent
from tests.test_videos_register import run


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


class Outbox:
    simulated = True

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    async def send(self, phone: str, text: str) -> None:
        self.sent.append((phone, text))


def test_reminders_go_a_day_and_two_hours_before_once(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """The timing, with SMS switched on (as it would be for the mobile app's notifications)."""
    monkeypatch.setattr(reminders, "BY_SMS", True)
    _, _, slot = published(client)  # 26 hours from now
    owner = parent(client)
    phone = client.get(f"{API}/me", headers=owner).json()["phone"]
    child = add_child(client, owner)
    b = client.post(
        f"{API}/children/{child}/bookings", headers=owner, json={"slotId": slot, "mode": "in_person"}
    ).json()
    starts = datetime.fromisoformat(b["startsAt"])
    box = Outbox()

    def at(now: datetime) -> list[str]:
        box.sent.clear()

        async def go(db: Any) -> None:
            await reminders.send_due(db, box, now)

        run(client, go)
        return [text for to, text in box.sent if to == phone]

    assert at(starts - timedelta(hours=25)) == []  # too early
    day = at(starts - timedelta(hours=23))
    assert len(day) == 1 and b["placeName"] in day[0]
    assert at(starts - timedelta(hours=22)) == []  # once
    assert len(at(starts - timedelta(minutes=90))) == 1  # 2 hours before
    assert at(starts - timedelta(minutes=30)) == []

    other = parent(client)
    other_phone = client.get(f"{API}/me", headers=other).json()["phone"]
    _, _, slot2 = published(client)
    c2 = add_child(client, other)
    b2 = client.post(f"{API}/children/{c2}/bookings", headers=other, json={"slotId": slot2, "mode": "in_person"}).json()
    client.post(f"{API}/children/{c2}/bookings/{b2['id']}/cancel", headers=other)
    at(datetime.fromisoformat(b2["startsAt"]) - timedelta(hours=1))
    assert not any(to == other_phone for to, _ in box.sent)  # cancelled: no reminder


def test_the_worker_runs_reminders_every_5_minutes() -> None:
    job = next(j for j in WorkerSettings.cron_jobs if j.coroutine is remind_visits)
    assert job.minute == set(range(0, 60, 5))


def test_no_sms_for_now_but_the_reminder_is_handled(client: TestClient) -> None:
    """G10: visit reminders wait for the mobile app; the job sends nothing but still marks each one once."""
    _, _, slot = published(client)
    owner = parent(client)
    child = add_child(client, owner)
    b = client.post(
        f"{API}/children/{child}/bookings", headers=owner, json={"slotId": slot, "mode": "in_person"}
    ).json()
    box = Outbox()
    handled: list[int] = []

    async def go(db: Any) -> None:
        handled.append(await reminders.send_due(db, box, datetime.fromisoformat(b["startsAt"]) - timedelta(hours=23)))
        booking = await db.get(Booking, uuid.UUID(b["id"]))
        assert booking.reminded_day_at is not None

    run(client, go)
    assert box.sent == [] and handled[0] >= 1
