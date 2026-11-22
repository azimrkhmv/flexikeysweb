"""B113: centre links, the code kept at sign-up, and the pilot numbers (retained and quiet families)."""

import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from app.modules.pilot import rules
from tests.test_admin_changes import make
from tests.test_children import API, add_child
from tests.test_videos_register import title

_phones = iter(range(1, 10_000))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------- the rules, with fixed dates

TODAY = date(2026, 11, 26)  # a Thursday; the last 4 full weeks start on Mondays 16, 9, 2 Nov and 26 Oct


def days(*spans: tuple[date, int]) -> set[date]:
    """`(start, n)`: n days in a row from start."""
    return {start + timedelta(i) for start, n in spans for i in range(n)}


def test_full_weeks_are_the_four_before_this_one() -> None:
    assert rules.full_weeks(TODAY) == [date(2026, 11, 16), date(2026, 11, 9), date(2026, 11, 2), date(2026, 10, 26)]
    assert rules.full_weeks(date(2026, 11, 23)) == rules.full_weeks(TODAY)  # Monday of the same week


def test_retained_needs_3_days_in_3_of_the_last_4_weeks() -> None:
    three_weeks = days((date(2026, 11, 16), 3), (date(2026, 11, 9), 3), (date(2026, 11, 2), 3))
    assert rules.is_retained(three_weeks, TODAY)
    assert rules.is_retained(three_weeks | days((date(2026, 10, 26), 7)), TODAY)
    two_weeks = days((date(2026, 11, 16), 7), (date(2026, 11, 9), 7), (date(2026, 11, 2), 2))
    assert not rules.is_retained(two_weeks, TODAY)  # the third week has only 2 days
    # This week does not count yet, and neither does a week before the window.
    assert not rules.is_retained(days((date(2026, 11, 23), 4), (date(2026, 11, 16), 3), (date(2026, 11, 9), 3)), TODAY)
    assert not rules.is_retained(days((date(2026, 11, 9), 3), (date(2026, 11, 2), 3), (date(2026, 10, 19), 7)), TODAY)
    assert not rules.is_retained(set(), TODAY)


def test_quiet_means_nothing_finished_in_the_last_3_days() -> None:
    assert rules.is_quiet(set(), TODAY)
    assert rules.is_quiet({date(2026, 11, 23)}, TODAY)  # 3 days ago
    assert not rules.is_quiet({date(2026, 11, 24)}, TODAY)  # 2 days ago
    assert not rules.is_quiet({TODAY}, TODAY)
    assert rules.last_active({date(2026, 11, 2), date(2026, 11, 23)}, TODAY) == date(2026, 11, 23)
    assert rules.last_active(set(), TODAY) is None


# ---------------------------------------------------------------- centre links and the numbers


def sign_up(client: TestClient, ref: str | None = None, region: str = "samarkand") -> tuple[dict[str, str], str]:
    phone = f"9151{next(_phones):05d}"
    code = client.post(f"{API}/auth/phone/start", json={"phone": phone}).json()["demoCode"]
    token = client.post(f"{API}/auth/phone/verify", json={"phone": phone, "code": code}).json()["accessToken"]
    auth = {"Authorization": f"Bearer {token}"}
    district = {"samarkand": "Samarqand shahri", "tashkent_city": "Chilonzor"}[region]
    body = {"region": region, "district": district, "consent": True, "ref": ref}
    assert client.patch(f"{API}/me/signup", headers=auth, json=body).status_code == 200
    return auth, client.get(f"{API}/me", headers=auth).json()["id"]


def test_admin_makes_centre_links(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    code = f"dv-{uuid.uuid4().hex[:6]}"
    made = client.post(f"{API}/admin/center-links", headers=admin, json={"name": "Dvijeniye", "code": code.upper()})
    assert made.status_code == 201
    assert any(link["code"] == code and link["signups"] == 0 for link in made.json())
    again = client.post(f"{API}/admin/center-links", headers=admin, json={"name": "Again", "code": code})
    assert title(again) == (409, "code_taken")
    assert title(client.post(f"{API}/admin/center-links", headers=admin, json={"name": "x", "code": "no spaces"})) == (
        422,
        "invalid_ref_code",
    )
    parent, _ = sign_up(client)
    assert client.get(f"{API}/admin/center-links", headers=parent).status_code == 403


def test_the_first_known_code_is_kept_and_counted(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    code, other = f"c-{uuid.uuid4().hex[:6]}", f"o-{uuid.uuid4().hex[:6]}"
    for c in (code, other):
        client.post(f"{API}/admin/center-links", headers=admin, json={"name": c, "code": c})
    auth, user_id = sign_up(client, ref=f"  {code.upper()} ")
    # The sign-up step sent again with another code: the first one stays.
    again = {"region": "samarkand", "district": "Samarqand shahri", "consent": True, "ref": other}
    assert client.patch(f"{API}/me/signup", headers=auth, json=again).status_code == 200
    _, unknown_id = sign_up(client, ref="nobody-has-this")

    links = {link["code"]: link["signups"] for link in client.get(f"{API}/admin/center-links", headers=admin).json()}
    assert links[code] == 1 and links[other] == 0
    numbers = client.get(f"{API}/admin/pilot", headers=admin).json()
    centers = {c["code"]: c for c in numbers["byCenter"]}
    assert centers[code]["count"] == 1 and centers[code]["name"] == code
    assert None in centers  # "no link", where the unknown code went
    quiet = {q["userId"]: q for q in numbers["quiet"]}
    assert quiet[user_id]["refCode"] == code and quiet[user_id]["region"] == "samarkand"
    assert quiet[unknown_id]["refCode"] is None and quiet[unknown_id]["lastActive"] is None
    assert numbers["signedUp"] >= 2 and sum(d["count"] for d in numbers["signupsByDay"]) == numbers["signedUp"]
    assert client.get(f"{API}/admin/pilot", headers=auth).status_code == 403


def test_a_game_today_takes_a_family_off_the_quiet_list(client: TestClient) -> None:
    _, admin, _ = make(client, Role.admin)
    auth, user_id = sign_up(client, region="tashkent_city")
    child = add_child(client, auth)
    a_try = {
        "id": str(uuid.uuid4()),
        "ts": datetime.now(UTC).isoformat(),
        "game": "find_cloudy",
        "level": 0,
        "itemId": "c1",
        "inputMode": "touch",
        "outcome": "correct",
        "attempts": 1,
        "hintShown": "none",
        "accessEvent": False,
        "helpedByAdult": False,
    }
    assert user_id in {q["userId"] for q in client.get(f"{API}/admin/pilot", headers=admin).json()["quiet"]}
    assert client.post(f"{API}/children/{child}/tries", headers=auth, json=[a_try]).json() == {"stored": 1}
    assert user_id not in {q["userId"] for q in client.get(f"{API}/admin/pilot", headers=admin).json()["quiet"]}


def test_an_older_account_may_give_only_its_region(client: TestClient) -> None:
    auth, _ = sign_up(client)
    assert client.patch(f"{API}/me", headers=auth, json={"region": "bukhara"}).json()["region"] == "bukhara"
    assert title(client.patch(f"{API}/me", headers=auth, json={"region": "atlantis"})) == (422, "invalid_district")
