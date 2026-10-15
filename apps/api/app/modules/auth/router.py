import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Family, FamilyMember, Lang, MemberRole, Role, User, UserStatus
from app.modules.auth import otp, tokens
from app.modules.auth.otp import Check
from app.modules.auth.sms import SmsSender, get_sms
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
    access_token: str
    refresh_token: str


async def _new_parent(db: AsyncSession, phone: str, lang: Lang) -> User:
    """First sign-in with an unknown number: a parent, their family, and the parent as its owner."""
    user, family = User(phone=phone, role=Role.parent, lang=lang), Family()
    db.add_all([user, family])
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role=MemberRole.owner))
    await db.flush()
    return user


_CODE_ERRORS = {Check.invalid_code: 400, Check.code_expired: 400, Check.too_many_tries: 429}


@router.post("/phone/verify")
async def phone_verify(
    body: PhoneVerify,
    redis: Annotated[Redis, Depends(get_redis)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> SignedIn:
    """Sign in with the SMS code. The first time a number is used, this creates a parent account."""
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
            user = await _new_parent(db, phone, body.lang)
        except IntegrityError:  # the same number signed up a moment ago in another request
            await db.rollback()
            user = (await db.execute(select(User).where(User.phone == phone))).scalar_one()
            is_new = False
    if user.status != UserStatus.active:
        raise AppError(403, "account_disabled")
    pair = await tokens.issue(db, user)
    await db.commit()
    return SignedIn(
        user=UserOut.model_validate(user, from_attributes=True),
        is_new=is_new,
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
    )
