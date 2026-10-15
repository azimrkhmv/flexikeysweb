"""How a signed-in person is recognised.

- Website: sends `X-Auth-Transport: cookie`. Tokens live in httpOnly cookies the page cannot read. Every write
  (not GET) must also send `X-CSRF-Token` equal to the readable `fk_csrf` cookie, so another website cannot make
  the browser write on the person's behalf (double-submit check; apps/web/src/lib/live/http.ts does this).
- Mobile app: tokens come back in the JSON body and go out as `Authorization: Bearer <access token>`.
"""

import hmac
import secrets
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import User, UserStatus
from app.modules.auth import tokens
from app.settings import settings

ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE = "fk_access", "fk_refresh", "fk_csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def wants_cookies(request: Request) -> bool:
    return request.headers.get("x-auth-transport") == "cookie"


def deliver(request: Request, response: Response, pair: tokens.TokenPair) -> tokens.TokenPair | None:
    """Cookies for the website (returns None: nothing in the body), the pair itself for the app."""
    if not wants_cookies(request):
        return pair
    secure = settings.env == "prod"
    response.set_cookie(
        ACCESS_COOKIE,
        pair.access_token,
        max_age=int(tokens.ACCESS_TTL.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/api/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        pair.refresh_token,
        max_age=int(tokens.REFRESH_TTL.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api/v1/auth/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        secrets.token_urlsafe(24),
        max_age=int(tokens.REFRESH_TTL.total_seconds()),
        httponly=False,
        secure=secure,
        samesite="strict",
        path="/",
    )
    return None


def clear(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/api/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def check_csrf(request: Request) -> None:
    """A cookie-signed-in write must echo the fk_csrf cookie in X-CSRF-Token."""
    if request.method in SAFE_METHODS:
        return
    cookie, header = request.cookies.get(CSRF_COOKIE, ""), request.headers.get("x-csrf-token", "")
    if not cookie or not hmac.compare_digest(cookie, header):
        raise AppError(403, "csrf_failed")


async def current_user(request: Request, db: Annotated[AsyncSession, Depends(get_session)]) -> User:
    """FastAPI dependency: the signed-in, active person, or 401."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:]
    elif token := request.cookies.get(ACCESS_COOKIE, ""):
        check_csrf(request)
    else:
        raise AppError(401, "unauthorized")
    claims = tokens.read_access_token(token)
    user = await db.get(User, uuid.UUID(str(claims["sub"])))
    if user is None or user.status != UserStatus.active:
        raise AppError(401, "unauthorized")
    if user.signed_out_at and int(str(claims["ts"])) < _ms(user.signed_out_at):
        raise AppError(401, "unauthorized")  # made before "sign out everywhere"
    return user


def _ms(t: datetime) -> int:
    return int(t.timestamp() * 1000)


CurrentUser = Annotated[User, Depends(current_user)]
