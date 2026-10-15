"""Sign-in tokens: a short access token (signed, 15 minutes) and a long refresh token (random, 30 days, one use)."""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.modules.accounts.models import User
from app.modules.auth.models import RefreshToken
from app.settings import settings

ACCESS_TTL = timedelta(minutes=15)
REFRESH_TTL = timedelta(days=30)


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def access_token(user: User) -> str:
    now = datetime.now(UTC)
    claims = {"sub": str(user.id), "role": user.role, "iat": now, "exp": now + ACCESS_TTL}
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def read_access_token(token: str) -> dict[str, object]:
    """The token's claims, or 401 if it is forged or expired."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise AppError(401, "unauthorized") from None


async def _new_refresh(db: AsyncSession, user_id: uuid.UUID, chain_id: uuid.UUID) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        RefreshToken(
            user_id=user_id, chain_id=chain_id, token_hash=_hash(token), expires_at=datetime.now(UTC) + REFRESH_TTL
        )
    )
    await db.flush()
    return token


async def issue(db: AsyncSession, user: User) -> TokenPair:
    """New sign-in on a new device: a new chain."""
    return TokenPair(access_token(user), await _new_refresh(db, user.id, uuid.uuid4()))


async def revoke_all(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Sign out everywhere."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def rotate(db: AsyncSession, refresh_token: str) -> TokenPair:
    """Swap a refresh token for a new pair. Reusing an old one signs the user out everywhere."""
    now = datetime.now(UTC)
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash(refresh_token)).with_for_update())
    ).scalar_one_or_none()
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise AppError(401, "invalid_token")
    if row.used_at is not None:
        await revoke_all(db, row.user_id)
        await db.commit()  # keep the sign-out even though this request fails
        raise AppError(401, "token_reused")
    user = await db.get(User, row.user_id)
    if user is None or user.status != "active":
        raise AppError(401, "invalid_token")
    row.used_at = now
    return TokenPair(access_token(user), await _new_refresh(db, user.id, row.chain_id))
