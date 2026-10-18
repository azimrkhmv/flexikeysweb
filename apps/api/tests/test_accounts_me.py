"""A1.6: /me, the sign-up step, the basic consent and its gate."""

import json
import re
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.modules.accounts.models import Lang, Role
from app.modules.auth import tokens
from tests.test_access import person

API = "/api/v1"
TASHKENT = {"region": "tashkent_city", "district": "Chilonzor"}

# Addresses a signed-in person may use before giving the basic consent. Every other address must refuse.
BEFORE_CONSENT = {
    ("POST", "/auth/phone/start"),
    ("POST", "/auth/phone/verify"),
    ("POST", "/auth/refresh"),
    ("POST", "/auth/logout"),
    ("POST", "/auth/logout-all"),
    ("GET", "/consents/basic"),
    ("GET", "/me"),
    ("PATCH", "/me/signup"),
}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def new_user(client: TestClient, phone: str) -> dict[str, str]:
    code = client.post(f"{API}/auth/phone/start", json={"phone": phone}).json()["demoCode"]
    token = client.post(f"{API}/auth/phone/verify", json={"phone": phone, "code": code}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_new_user_must_sign_up_first(client: TestClient) -> None:
    me = client.get(f"{API}/me", headers=new_user(client, "+998913000001")).json()
    assert me["needsSignup"] is True
    assert me["consentVersion"] is None


def test_before_consent_every_other_address_is_refused(client: TestClient) -> None:
    auth = new_user(client, "+998913000002")
    checked = 0
    for path, operations in app.openapi()["paths"].items():  # every address the server publishes
        if not path.startswith(API):
            continue
        for method in (m.upper() for m in operations):
            if (method, path.removeprefix(API)) in BEFORE_CONSENT:
                continue
            url = re.sub(r"\{[^}]+\}", "00000000-0000-0000-0000-000000000000", path)
            r = client.request(method, url, headers=auth)
            assert (r.status_code, r.json().get("title")) == (403, "consent_required"), f"{method} {path}"
            checked += 1
    assert checked >= 1  # PATCH /me today; every new address joins this check by itself


def test_signup_needs_the_consent(client: TestClient) -> None:
    r = client.patch(f"{API}/me/signup", headers=new_user(client, "+998913000003"), json=TASHKENT | {"consent": False})
    assert (r.status_code, r.json()["title"]) == (422, "consent_required")


def test_signup_needs_a_real_district(client: TestClient) -> None:
    auth = new_user(client, "+998913000004")
    bad = {"region": "tashkent_city", "district": "Nukus", "consent": True}
    r = client.patch(f"{API}/me/signup", headers=auth, json=bad)
    assert (r.status_code, r.json()["title"]) == (422, "invalid_district")


def test_after_signup_the_rest_opens(client: TestClient) -> None:
    auth = new_user(client, "+998913000005")
    r = client.patch(f"{API}/me/signup", headers=auth, json=TASHKENT | {"name": " Dilnoza ", "consent": True})
    assert r.status_code == 200
    me = r.json()
    assert (me["needsSignup"], me["name"], me["district"]) == (False, "Dilnoza", "Chilonzor")
    assert me["consentVersion"] == "2026-09-v1"

    r = client.patch(f"{API}/me", headers=auth, json={"lang": "uz_cyrl", "district": "Yunusobod"})
    assert r.status_code == 200
    assert (r.json()["lang"], r.json()["district"]) == ("uz_cyrl", "Yunusobod")


def test_consent_text_in_all_4_languages(client: TestClient) -> None:
    texts = set()
    for lang in Lang:
        body = client.get(f"{API}/consents/basic", params={"lang": lang.value}).json()
        assert body["version"] == "2026-09-v1"
        assert body["text"] and body["detail"]
        texts.add(body["text"])
    assert len(texts) == 4


def test_district_list_matches_the_website() -> None:
    web = Path(__file__).parents[2] / "web/src/content/backend/districts.json"
    if not web.exists():  # the server alone, without the website next to it
        pytest.skip("website files not present")
    server = Path(__file__).parents[1] / "app/content/districts.json"
    assert json.loads(server.read_text("utf-8")) == json.loads(web.read_text("utf-8")), "copy the website's file"


@pytest.mark.parametrize("role", [Role.physio, Role.clinic, Role.admin])
def test_staff_work_without_the_parents_consent(client: TestClient, role: Role) -> None:
    """A1.9: an admin makes staff accounts for work; they hold no family's data, so no basic consent step."""

    async def staff() -> str:
        async with SessionLocal() as db:
            user = await person(db, role, consent=False)
            pair = await tokens.issue(db, user)
            await db.commit()
            return pair.access_token

    auth = {"Authorization": f"Bearer {client.portal.call(staff)}"}  # type: ignore[union-attr]
    assert client.get(f"{API}/me", headers=auth).json()["needsSignup"] is False
    assert client.get(f"{API}/children", headers=auth).status_code == 200  # signed in like anyone else: sees no child
