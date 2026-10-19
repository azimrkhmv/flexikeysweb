import re
import time
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import Field
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_json
from app.db import get_session
from app.errors import AppError, problem
from app.modules.accounts.models import Family, FamilyMember, Lang, MemberRole, Role, User, UserStatus
from app.modules.auth import otp, session, tokens, totp
from app.modules.auth.otp import Check
from app.modules.auth.sms import SmsSender, get_sms
from app.modules.therapists.models import link_for_code, pending_for_phone
from app.redis import get_redis
from app.schemas import ApiModel

router = APIRouter(prefix="/auth", tags=["auth"])


def normalize_phone(raw: str) -> str | None:
    """ "+998 90 123-45-67" or "90 123 45 67" -> "+998901234567"; None if not an Uzbek mobile number.

    Same rule as the website (apps/web/src/lib/api/auth.ts normalizePhone).
    """
    digits = re.sub(r"\D", "", raw)
    local = digits[3:] if len(digits) == 12 and digits.startswith("998") else digits
    return f"+998{local}" if re.fullmatch(r"\d{9}", local) else None


class PhoneStart(ApiModel):
    phone: str


class PhoneStarted(ApiModel):
    phone: str
    resend_after_ms: int
    demo_code: str | None = None  # only while SMS is simulated


@router.post("/phone/start", response_model_exclude_none=True)
async def phone_start(
    body: PhoneStart,
    request: Request,
    redis: Annotated[Redis, Depends(get_redis)],
    sms: Annotated[SmsSender, Depends(get_sms)],
) -> PhoneStarted:
    """Send a 6-digit sign-in code by SMS."""
    phone = normalize_phone(body.phone)
    if not phone:
        raise AppError(422, "invalid_phone")
    ip = request.client.host if request.client else "unknown"
    code = await otp.new_code(redis, phone, ip)
    await sms.send(phone, f"FlexiKeys: {code}")
    return PhoneStarted(phone=phone, resend_after_ms=otp.RESEND_AFTER * 1000, demo_code=code if sms.simulated else None)


class PhoneVerify(ApiModel):
    phone: str
    code: str
    lang: Lang = Lang.uz  # the language the person signs up in
    invite_code: str | None = None  # a therapist opening a share link (A8.1)


class UserOut(ApiModel):
    id: uuid.UUID
    phone: str
    role: Role
    status: UserStatus
    lang: Lang
    region: str | None
    district: str | None


class SignedIn(ApiModel):
    user: UserOut
    is_new: bool
    # Only for the app. The website gets cookies instead (app/modules/auth/session.py).
    access_token: str | None = None
    refresh_token: str | None = None


class Tokens(ApiModel):
    access_token: str | None = None
    refresh_token: str | None = None


class RefreshBody(ApiModel):
    refresh_token: str | None = None  # the app sends it here; the website's is in a cookie


async def _new_account(db: AsyncSession, phone: str, lang: Lang, invite_code: str | None) -> User:
    """First sign-in with an unknown number: a parent, their family, and the parent as its owner.
    A number a parent invited as a therapist, or someone opening a therapist link, becomes a therapist instead
    (no family); the phone invites then wait for them under /therapist/invites."""
    invites = await pending_for_phone(db, phone)
    if invites or (invite_code and await link_for_code(db, invite_code)):
        user = User(phone=phone, role=Role.therapist, lang=lang)
        db.add(user)
        await db.flush()
        for link in invites:
            link.therapist_id = user.id
        await db.flush()
        return user
    user, family = User(phone=phone, role=Role.parent, lang=lang), Family()
    db.add_all([user, family])
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role=MemberRole.owner))
    await db.flush()
    return user


_CODE_ERRORS = {Check.invalid_code: 400, Check.code_expired: 400, Check.too_many_tries: 429}


@router.post("/phone/verify", response_model_exclude_none=True)
async def phone_verify(
    body: PhoneVerify,
    request: Request,
    response: Response,
    redis: Annotated[Redis, Depends(get_redis)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> SignedIn:
    """Sign in with the SMS code. The first time a number is used, this creates a parent account (or a therapist's,
    see `_new_account`)."""
    phone = normalize_phone(body.phone)
    if not phone:
        raise AppError(422, "invalid_phone")
    result = await otp.check_code(redis, phone, body.code)
    if result != Check.ok:
        raise AppError(_CODE_ERRORS[result], result.value)
    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    is_new = user is None
    if user is None:
        try:
            user = await _new_account(db, phone, body.lang, body.invite_code)
        except IntegrityError:  # the same number signed up a moment ago in another request
            await db.rollback()
            user = (await db.execute(select(User).where(User.phone == phone))).scalar_one()
            is_new = False
    if user.status != UserStatus.active:
        raise AppError(403, "account_disabled")
    pair = await tokens.issue(db, user)
    await db.commit()
    body_pair = session.deliver(request, response, pair)
    return SignedIn(
        user=UserOut.model_validate(user, from_attributes=True),
        is_new=is_new,
        access_token=body_pair.access_token if body_pair else None,
        refresh_token=body_pair.refresh_token if body_pair else None,
    )


def _refresh_token(request: Request, body: RefreshBody | None) -> str:
    """The refresh token from the website's cookie (with the CSRF check) or from the app's body."""
    if session.wants_cookies(request):
        session.check_csrf(request)
        token = request.cookies.get(session.REFRESH_COOKIE)
    else:
        token = body.refresh_token if body else None
    if not token:
        raise AppError(401, "unauthorized")
    return token


@router.post("/refresh", response_model=Tokens, response_model_exclude_none=True)
async def refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_session)],
    body: RefreshBody | None = None,
) -> Tokens | JSONResponse:
    """New tokens for a refresh token. Each refresh token works once."""
    try:
        pair = await tokens.rotate(db, _refresh_token(request, body))
    except AppError as e:
        failed = problem(e.status, e.code)
        session.clear(failed)  # a dead session: the browser drops its cookies too
        return failed
    await db.commit()
    body_pair = session.deliver(request, response, pair)
    return Tokens(**vars(body_pair)) if body_pair else Tokens()


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_session)],
    body: RefreshBody | None = None,
) -> None:
    """Sign out on this device."""
    await tokens.revoke_chain(db, _refresh_token(request, body))
    await db.commit()
    session.clear(response)


class SecondStep(ApiModel):
    code: str = Field(pattern=r"^\d{6}$")


SECOND_STEP_TRIES = 5  # wrong codes per 15 minutes


@router.post("/second-step", response_model_exclude_none=True)
async def second_step(
    body: SecondStep,
    user: session.CurrentUser,
    request: Request,
    response: Response,
    redis: Annotated[Redis, Depends(get_redis)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Tokens:
    """An admin's code from the authenticator app (A13.1): new tokens that may act as admin. Each code works once.
    409 second_step_not_set (no authenticator yet: `uv run python -m app.cli reset-second-step <phone>` on the
    server), 400 invalid_code, 429 too_many_tries."""
    if user.role != Role.admin or not user.totp_secret:
        raise AppError(409, "second_step_not_set")
    tries = f"totp:tries:{user.id}"
    if int(await redis.get(tries) or 0) >= SECOND_STEP_TRIES:
        raise AppError(429, "too_many_tries")
    step = totp.matching_step(decrypt_json(user.totp_secret), body.code, time.time())
    if step is None or (user.totp_last_step is not None and step <= user.totp_last_step):
        await redis.incr(tries)
        await redis.expire(tries, 900)
        raise AppError(400, "invalid_code")
    user.totp_last_step = step
    pair = await tokens.issue(db, user, mfa=True)
    await db.commit()
    body_pair = session.deliver(request, response, pair)
    return Tokens(**vars(body_pair)) if body_pair else Tokens()


@router.post("/logout-all", status_code=204)
async def logout_all(
    user: session.SignedInUser, response: Response, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """Sign out on every device."""
    await tokens.revoke_all(db, user.id)
    await db.commit()
    session.clear(response)
