import re
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis

from app.errors import AppError
from app.modules.auth import otp
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
