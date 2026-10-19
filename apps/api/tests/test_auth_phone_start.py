"""A1.2: sign-in codes. Needs Redis: `docker compose up -d db redis`."""

from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app import redis as app_redis
from app.main import app
from app.modules.auth import otp
from app.modules.auth.otp import Check
from app.settings import settings


@pytest.fixture
async def redis() -> AsyncIterator[Redis]:
    r = app_redis.connect()
    yield r
    await r.aclose()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_sends_a_code_and_shows_it_while_sms_is_simulated(client: TestClient) -> None:
    r = client.post("/api/v1/auth/phone/start", json={"phone": "+998 90 123-45-67"})
    assert r.status_code == 200
    body = r.json()
    assert body["phone"] == "+998901234567"
    assert body["resendAfterMs"] == 60_000
    assert len(body["demoCode"]) == 6 and body["demoCode"].isdigit()


def test_not_an_uzbek_mobile_number(client: TestClient) -> None:
    r = client.post("/api/v1/auth/phone/start", json={"phone": "12345"})
    assert (r.status_code, r.json()["title"]) == (422, "invalid_phone")


def test_new_code_only_after_60_seconds(client: TestClient) -> None:
    assert client.post("/api/v1/auth/phone/start", json={"phone": "901234567"}).status_code == 200
    r = client.post("/api/v1/auth/phone/start", json={"phone": "901234567"})
    assert (r.status_code, r.json()["title"]) == (429, "code_too_soon")
    assert 0 < r.json()["retryAfterMs"] <= 60_000


@pytest.mark.anyio
async def test_60_second_wait_ends(redis: Redis) -> None:
    await otp.new_code(redis, "+998901111111", "1.1.1.1")
    await redis.delete("otp:cooldown:+998901111111")  # what Redis does by itself after 60 seconds
    await otp.new_code(redis, "+998901111111", "1.1.1.1")


@pytest.mark.anyio
async def test_at_most_5_codes_per_phone_per_hour(redis: Redis) -> None:
    for _ in range(otp.PER_PHONE_PER_HOUR):
        await otp.new_code(redis, "+998902222222", "2.2.2.2")
        await redis.delete("otp:cooldown:+998902222222")
    with pytest.raises(Exception, match="too_many_codes") as e:
        await otp.new_code(redis, "+998902222222", "2.2.2.2")
    assert getattr(e.value, "status", None) == 429


@pytest.mark.anyio
async def test_at_most_20_codes_per_ip_per_hour(redis: Redis) -> None:
    for i in range(settings.otp_per_ip_per_hour):
        await otp.new_code(redis, f"+9989030000{i:02d}", "3.3.3.3")
    with pytest.raises(Exception, match="too_many_codes"):
        await otp.new_code(redis, "+998903000099", "3.3.3.3")
    await otp.new_code(redis, "+998903000098", "4.4.4.4")  # another address is not blocked


@pytest.mark.anyio
async def test_5_wrong_tries_kill_the_code(redis: Redis) -> None:
    code = await otp.new_code(redis, "+998904444444", "5.5.5.5")
    wrong = "000000" if code != "000000" else "111111"
    results = [await otp.check_code(redis, "+998904444444", wrong) for _ in range(otp.MAX_TRIES)]
    assert results == [Check.invalid_code] * 4 + [Check.too_many_tries]
    assert await otp.check_code(redis, "+998904444444", code) == Check.too_many_tries


@pytest.mark.anyio
async def test_right_code_works_once(redis: Redis) -> None:
    code = await otp.new_code(redis, "+998905555555", "6.6.6.6")
    assert await otp.check_code(redis, "+998905555555", code) == Check.ok
    assert await otp.check_code(redis, "+998905555555", code) == Check.code_expired
