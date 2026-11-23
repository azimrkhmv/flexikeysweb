"""B120: the load test's sign-in bypass. Off unless FK_LOADTEST_SECRET is set; then only for +998 00 ... numbers that
send the secret; it skips the code limits and sends no SMS. Production refuses a short secret."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.sms import get_sms
from app.settings import Settings, settings

API = "/api/v1"
SECRET = "s" * 40
_n = iter(range(1, 100_000))


class RealishSms:
    """Like a real provider: not simulated, so no code comes back; remembers what it sent."""

    simulated = False

    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, phone: str, text: str) -> None:
        self.sent.append(phone)


@pytest.fixture
def sms() -> Iterator[RealishSms]:
    s = RealishSms()
    app.dependency_overrides[get_sms] = lambda: s
    yield s
    app.dependency_overrides.pop(get_sms, None)


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def fresh_number(prefix: str = "00") -> str:
    return f"+998{prefix}{next(_n):07d}"


def start(client: TestClient, phone: str, secret: str | None = None) -> dict[str, object]:
    headers = {"X-FK-Loadtest": secret} if secret is not None else {}
    r = client.post(f"{API}/auth/phone/start", json={"phone": phone}, headers=headers)
    return {"status": r.status_code, **r.json()}


def test_off_by_default(client: TestClient, sms: RealishSms) -> None:
    assert settings.fk_loadtest_secret == ""
    phone = fresh_number()
    got = start(client, phone, SECRET)
    assert got["status"] == 200 and "demoCode" not in got  # a normal sign-in: the code goes by SMS only
    assert sms.sent == [phone]
    assert start(client, phone, SECRET)["status"] == 429  # and the 60-second wait applies


def test_with_the_secret_a_test_number_skips_limits_and_sms(
    client: TestClient, sms: RealishSms, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "fk_loadtest_secret", SECRET)
    phone = fresh_number()
    first = start(client, phone, SECRET)
    again = start(client, phone, SECRET)  # no 60-second wait
    assert first["status"] == again["status"] == 200
    assert isinstance(again["demoCode"], str) and len(again["demoCode"]) == 6
    assert sms.sent == []
    # More codes from one address than the hourly limit allows.
    assert all(start(client, fresh_number(), SECRET)["status"] == 200 for _ in range(settings.otp_per_ip_per_hour + 2))
    # The code signs in, and the account is a normal parent.
    r = client.post(f"{API}/auth/phone/verify", json={"phone": phone, "code": again["demoCode"]})
    assert r.status_code == 200 and r.json()["user"]["role"] == "parent"


def test_a_wrong_secret_or_a_real_number_gets_nothing_special(
    client: TestClient, sms: RealishSms, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "fk_loadtest_secret", SECRET)
    wrong = start(client, fresh_number(), "x" * 40)
    assert wrong["status"] == 200 and "demoCode" not in wrong
    real = fresh_number("90")
    got = start(client, real, SECRET)
    assert got["status"] == 200 and "demoCode" not in got
    assert start(client, real, SECRET)["status"] == 429
    assert len(sms.sent) == 2


def test_production_refuses_a_short_secret() -> None:
    base = settings.model_dump() | {"env": "dev"}
    with pytest.raises(ValueError, match="FK_LOADTEST_SECRET"):
        Settings(**(base | {"env": "prod", "sms_provider": "fake", "fk_loadtest_secret": "short"}))
    Settings(**(base | {"fk_loadtest_secret": "short"}))  # a developer's computer may use anything
