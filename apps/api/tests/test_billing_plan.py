"""A7.1: Free and Pro per family; the 7-day trial of Pro, once per family."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.main import app
from app.modules.accounts.models import Role
from app.modules.billing.models import FamilyPlan
from app.modules.billing.router import status_of
from app.modules.children.models import Child
from tests.test_admin_changes import make
from tests.test_children import API, add_child, add_helper, parent
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_the_rules() -> None:
    now = datetime(2026, 10, 1, tzinfo=UTC)
    assert status_of(None, now).model_dump() == {
        "plan": "free", "trial": False, "trial_used": False, "trial_ends_at": None, "paid_until": None,
    }  # fmt: skip
    started = FamilyPlan(trial_started_at=now - timedelta(days=6))
    assert (status_of(started, now).plan, status_of(started, now).trial) == ("pro", True)
    ended = FamilyPlan(trial_started_at=now - timedelta(days=8))
    assert (status_of(ended, now).plan, status_of(ended, now).trial_used) == ("free", True)
    paid = FamilyPlan(trial_started_at=now - timedelta(days=1), paid_until=now + timedelta(days=30))
    assert (status_of(paid, now).plan, status_of(paid, now).trial) == ("pro", False)


def plan(client: TestClient, who: dict[str, str]) -> Any:
    return client.get(f"{API}/family/plan", headers=who)


def test_the_owner_starts_the_trial_once(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    assert plan(client, owner).json()["plan"] == "free"
    assert title(client.post(f"{API}/family/trial", headers=helper)) == (403, "owner_only")
    started = client.post(f"{API}/family/trial", headers=owner).json()
    assert (started["plan"], started["trial"]) == ("pro", True)
    ends = datetime.fromisoformat(started["trialEndsAt"])
    assert timedelta(days=6, hours=23) < ends - datetime.now(UTC) <= timedelta(days=7)
    assert plan(client, helper).json()["plan"] == "pro"  # the whole family
    assert title(client.post(f"{API}/family/trial", headers=owner)) == (409, "trial_used")

    async def eight_days_later(db: Any) -> None:
        family = await db.scalar(select(Child.family_id).where(Child.id == uuid.UUID(child)))
        moved = datetime.now(UTC) - timedelta(days=8)
        await db.execute(update(FamilyPlan).where(FamilyPlan.family_id == family).values(trial_started_at=moved))
        await db.commit()

    run(client, eight_days_later)
    after = plan(client, owner).json()
    assert (after["plan"], after["trialUsed"]) == ("free", True)


def test_staff_have_no_family_plan(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    assert title(plan(client, admin)) == (404, "no_family")
