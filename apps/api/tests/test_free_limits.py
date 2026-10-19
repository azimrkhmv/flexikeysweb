"""A7.2: what Free does not include (spec §14, the founders' PROPOSAL; placeholders until G3). Each limit is a
setting. Pro (paid or the trial) has none."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.main import app
from app.modules.billing.models import FamilyPlan
from app.modules.children.models import Child
from app.settings import settings
from tests.test_billing_plan import on_pro
from tests.test_children import API, add_child, parent
from tests.test_intake_rounds import complete, finish
from tests.test_intake_save import health_consent, save
from tests.test_plan_read import move_start
from tests.test_therapist_form import share
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def free_family_with_plan(client: TestClient) -> tuple[dict[str, str], str]:
    owner = parent(client)
    child = add_child(client, owner)
    health_consent(client, owner, child)
    save(client, owner, child, complete(with_health=True))
    assert finish(client, owner, child).status_code == 200
    return owner, child


def test_free_has_the_first_week_of_the_plan(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    owner, child = free_family_with_plan(client)
    plan = client.get(f"{API}/children/{child}/plan", headers=owner).json()
    assert [d["day"] for d in plan["days"]] == list(range(7)) and plan["freeDays"] == 7
    move_start(client, child, 3)
    assert client.get(f"{API}/children/{child}/today", headers=owner).json()["day"] == 3
    move_start(client, child, 8)
    assert title(client.get(f"{API}/children/{child}/today", headers=owner)) == (403, "pro_only")
    done = {"day": 8, "exerciseId": "putty_squeeze"}
    assert title(client.post(f"{API}/children/{child}/done", headers=owner, json=done)) == (403, "pro_only")
    assert title(client.get(f"{API}/children/{child}/videos", headers=owner)) == (403, "pro_only")  # offline

    monkeypatch.setattr(settings, "free_plan_days", 28)  # the founders change what Free includes
    assert len(client.get(f"{API}/children/{child}/plan", headers=owner).json()["days"]) == 28

    monkeypatch.setattr(settings, "free_plan_days", 7)
    on_pro(client, owner)
    plan = client.get(f"{API}/children/{child}/plan", headers=owner).json()
    assert len(plan["days"]) == 28 and plan["freeDays"] is None
    assert client.get(f"{API}/children/{child}/today", headers=owner).json()["day"] == 8


def test_a_share_waits_while_the_family_is_on_free(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    client.put(f"{API}/children/{child}/consents/therapist_share", headers=owner, json={"granted": True})
    assert title(client.post(f"{API}/children/{child}/therapists", headers=owner, json={})) == (403, "pro_only")
    therapist = share(client, owner, child)  # on the trial
    seen = f"{API}/therapist/children/{child}"
    assert client.get(seen, headers=therapist).status_code == 200

    async def trial_over(db: Any) -> None:
        family = (await db.get(Child, uuid.UUID(child))).family_id
        week_ago = datetime.now(UTC) - timedelta(days=8)
        await db.execute(update(FamilyPlan).where(FamilyPlan.family_id == family).values(trial_started_at=week_ago))
        await db.commit()

    run(client, trial_over)
    assert title(client.get(seen, headers=therapist)) == (403, "pro_only")
