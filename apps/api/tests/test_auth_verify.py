"""A1.3: signing in with the SMS code, and the one-use refresh tokens."""

import asyncio
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import redis
from app.errors import AppError
from app.main import app
from app.modules.accounts.models import FamilyMember, Lang, MemberRole, Role, User, UserStatus
from app.modules.auth import tokens
from app.modules.auth.router import _new_account


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def sign_in(client: TestClient, phone: str) -> dict[str, object]:
    code = client.post("/api/v1/auth/phone/start", json={"phone": phone}).json()["demoCode"]
    r = client.post("/api/v1/auth/phone/verify", json={"phone": phone, "code": code, "lang": "ru"})
    assert r.status_code == 200, r.text
    return r.json()  # type: ignore[no-any-return]


def skip_60_second_wait(phone: str) -> None:
    async def delete() -> None:
        r = redis.connect()
        await r.delete(f"otp:cooldown:{phone}")
        await r.aclose()

    asyncio.run(delete())


def test_first_sign_in_creates_a_parent_who_owns_a_new_family(client: TestClient) -> None:
    body = sign_in(client, "+998911000001")
    assert body["isNew"] is True
    user = body["user"]
    assert isinstance(user, dict)
    assert (user["role"], user["lang"], user["phone"]) == ("parent", "ru", "+998911000001")
    claims = tokens.read_access_token(str(body["accessToken"]))
    assert claims["sub"] == user["id"]


def test_second_sign_in_finds_the_same_person(client: TestClient) -> None:
    first = sign_in(client, "+998911000002")
    skip_60_second_wait("+998911000002")
    again = sign_in(client, "+998911000002")
    assert again["isNew"] is False
    assert again["user"]["id"] == first["user"]["id"]  # type: ignore[index]


def test_wrong_code(client: TestClient) -> None:
    client.post("/api/v1/auth/phone/start", json={"phone": "+998911000003"})
    r = client.post("/api/v1/auth/phone/verify", json={"phone": "+998911000003", "code": "not-it"})
    assert (r.status_code, r.json()["title"]) == (400, "invalid_code")


def test_no_code_was_asked_for(client: TestClient) -> None:
    r = client.post("/api/v1/auth/phone/verify", json={"phone": "+998911000004", "code": "123456"})
    assert (r.status_code, r.json()["title"]) == (400, "code_expired")


pytestmark = pytest.mark.anyio


async def _user(session: AsyncSession, phone: str) -> User:
    user = User(phone=phone, role=Role.parent)
    session.add(user)
    await session.commit()
    return user


async def test_a_new_parent_owns_exactly_one_new_family(session: AsyncSession) -> None:
    user = await _new_account(session, "+998911000005", Lang.uz, None)
    rows = (await session.execute(select(FamilyMember).where(FamilyMember.user_id == user.id))).scalars().all()
    assert [r.role for r in rows] == [MemberRole.owner]
    await session.rollback()


async def test_refresh_token_works_once_and_gives_a_new_one(session: AsyncSession) -> None:
    user = await _user(session, "+998911000010")
    first = await tokens.issue(session, user)
    second = await tokens.rotate(session, first.refresh_token)
    third = await tokens.rotate(session, second.refresh_token)
    assert len({first.refresh_token, second.refresh_token, third.refresh_token}) == 3
    await session.commit()


async def test_reusing_an_old_refresh_token_signs_out_everywhere(session: AsyncSession) -> None:
    user = await _user(session, "+998911000011")
    phone = await tokens.issue(session, user)  # signed in on a phone
    laptop = await tokens.issue(session, user)  # and on a laptop
    phone_next = await tokens.rotate(session, phone.refresh_token)
    await session.commit()

    with pytest.raises(AppError) as e:  # someone replays the phone's old token
        await tokens.rotate(session, phone.refresh_token)
    assert (e.value.status, e.value.code) == (401, "token_reused")

    for token in (phone_next.refresh_token, laptop.refresh_token):  # every device is now signed out
        with pytest.raises(AppError) as e:
            await tokens.rotate(session, token)
        assert e.value.code == "invalid_token"


async def test_disabled_account_cannot_refresh(session: AsyncSession) -> None:
    user = await _user(session, "+998911000012")
    pair = await tokens.issue(session, user)
    user.status = UserStatus.disabled
    await session.commit()
    with pytest.raises(AppError):
        await tokens.rotate(session, pair.refresh_token)
