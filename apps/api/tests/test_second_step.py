"""A13.1: an admin needs the authenticator code too; a stolen SMS code alone cannot act as an admin."""

import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import redis
from app.cli import set_second_step
from app.main import app
from app.modules.accounts.admin import create_staff
from app.modules.accounts.models import Role
from app.modules.auth import totp
from tests.test_children import API
from tests.test_videos_register import run, title

_phones = iter(range(1, 10_000))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def new_admin(client: TestClient) -> tuple[str, str]:
    phone = f"+99890800{next(_phones):04d}"

    async def go(db: Any) -> str:
        return await set_second_step(db, await create_staff(db, phone, Role.admin))

    return phone, run(client, go)


def sms_sign_in(client: TestClient, phone: str) -> dict[str, Any]:
    code = client.post(f"{API}/auth/phone/start", json={"phone": phone}).json()["demoCode"]
    return client.post(f"{API}/auth/phone/verify", json={"phone": phone, "code": code}).json()  # type: ignore[no-any-return]


def test_the_sms_code_alone_cannot_act_as_admin(client: TestClient) -> None:
    phone, secret = new_admin(client)
    signed = sms_sign_in(client, phone)
    sms_only = {"Authorization": f"Bearer {signed['accessToken']}"}
    assert title(client.get(f"{API}/admin/places", headers=sms_only)) == (403, "second_step_required")
    assert client.get(f"{API}/me", headers=sms_only).json()["needsSecondStep"] is True

    code = totp.code_at(secret, int(time.time() // totp.STEP))
    done = client.post(f"{API}/auth/second-step", headers=sms_only, json={"code": code})
    assert done.status_code == 200, done.text
    admin = {"Authorization": f"Bearer {done.json()['accessToken']}"}
    assert client.get(f"{API}/admin/places", headers=admin).status_code == 200
    assert client.get(f"{API}/me", headers=admin).json()["needsSecondStep"] is False
    assert title(client.post(f"{API}/auth/second-step", headers=sms_only, json={"code": code})) == (400, "invalid_code")

    # The refreshed tokens keep the second step; the SMS-only chain never gets it.
    again = client.post(f"{API}/auth/refresh", json={"refreshToken": done.json()["refreshToken"]}).json()
    assert (
        client.get(f"{API}/admin/places", headers={"Authorization": f"Bearer {again['accessToken']}"}).status_code
        == 200
    )
    plain = client.post(f"{API}/auth/refresh", json={"refreshToken": signed["refreshToken"]}).json()
    assert (
        title(client.get(f"{API}/admin/places", headers={"Authorization": f"Bearer {plain['accessToken']}"}))[1]
        == "second_step_required"
    )


def test_wrong_codes_are_limited(client: TestClient) -> None:
    phone, _ = new_admin(client)
    sms_only = {"Authorization": f"Bearer {sms_sign_in(client, phone)['accessToken']}"}
    for _ in range(5):
        assert title(client.post(f"{API}/auth/second-step", headers=sms_only, json={"code": "000000"}))[1] in {
            "invalid_code"
        }
    assert title(client.post(f"{API}/auth/second-step", headers=sms_only, json={"code": "000000"})) == (
        429,
        "too_many_tries",
    )

    async def clear() -> None:
        r = redis.connect()
        await r.delete(*[k async for k in r.scan_iter("totp:tries:*")])
        await r.aclose()

    client.portal.call(clear)  # type: ignore[union-attr]


def test_the_codes_follow_rfc_6238() -> None:
    # RFC 6238 test secret "12345678901234567890" (base32), T = 59 s: 94287082, last 6 digits.
    assert totp.code_at("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59 // 30) == "287082"
