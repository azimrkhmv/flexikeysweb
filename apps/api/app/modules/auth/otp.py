"""One-time sign-in codes, kept in Redis.

Limits (the same numbers as the website demo, apps/web/src/lib/api/schema.ts):
- a new code for the same phone at most every 60 seconds;
- 5 wrong tries per code, then the code is dead;
- at most 5 codes per phone and 20 codes per IP address per hour, against SMS abuse.
"""

import hashlib
import hmac
import secrets
from enum import StrEnum
from typing import cast

from redis.asyncio import Redis

from app.errors import AppError

CODE_TTL = 5 * 60
RESEND_AFTER = 60
MAX_TRIES = 5
PER_PHONE_PER_HOUR = 5
PER_IP_PER_HOUR = 20


def _hash(phone: str, code: str) -> str:
    return hashlib.sha256(f"{phone}:{code}".encode()).hexdigest()


async def _count(redis: Redis, key: str, limit: int) -> bool:
    """Add one to an hourly counter; False once it is over the limit."""
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, 3600)
    return int(n) <= limit


async def new_code(redis: Redis, phone: str, ip: str) -> str:
    """Make and store a fresh 6-digit code, or raise 429 when a limit is hit."""
    if not await redis.set(f"otp:cooldown:{phone}", 1, ex=RESEND_AFTER, nx=True):
        wait = await redis.ttl(f"otp:cooldown:{phone}")
        raise AppError(429, "code_too_soon", retryAfterMs=max(wait, 1) * 1000)
    if not await _count(redis, f"otp:hour:phone:{phone}", PER_PHONE_PER_HOUR):
        raise AppError(429, "too_many_codes")
    if not await _count(redis, f"otp:hour:ip:{ip}", PER_IP_PER_HOUR):
        raise AppError(429, "too_many_codes")
    code = f"{secrets.randbelow(900_000) + 100_000}"
    await redis.hset(f"otp:{phone}", mapping={"hash": _hash(phone, code), "tries": 0})
    await redis.expire(f"otp:{phone}", CODE_TTL)
    return code


class Check(StrEnum):
    ok = "ok"
    invalid_code = "invalid_code"
    too_many_tries = "too_many_tries"
    code_expired = "code_expired"


async def check_code(redis: Redis, phone: str, code: str) -> Check:
    """Used by sign-in (A1.3). A right code is used up; a wrong one counts as a try."""
    key = f"otp:{phone}"
    stored = cast(dict[str, str], await redis.hgetall(key))  # decode_responses=True gives str
    if not stored:
        return Check.code_expired
    if int(stored["tries"]) >= MAX_TRIES:
        return Check.too_many_tries
    if hmac.compare_digest(stored["hash"], _hash(phone, code.strip())):
        await redis.delete(key)
        return Check.ok
    tries = await redis.hincrby(key, "tries", 1)
    return Check.too_many_tries if tries >= MAX_TRIES else Check.invalid_code
