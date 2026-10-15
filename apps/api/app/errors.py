"""Every error leaves the server as problem+json (RFC 9457) with a short snake_case code in `title`.

The website maps `title` to its own messages (apps/web/src/lib/live/http.ts), so a code, once used, never changes.
"""

from contextvars import ContextVar
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

# The current request's number; set by the middleware in app/logs.py, used in log lines and error bodies.
request_id: ContextVar[str] = ContextVar("request_id", default="-")


class AppError(Exception):
    """Raise this from any module: `raise AppError(409, "phone_taken")`."""

    def __init__(self, status: int, code: str, detail: str | None = None, **extra: Any) -> None:
        self.status, self.code, self.detail, self.extra = status, code, detail, extra


def problem(status: int, code: str, detail: str | None = None, **extra: Any) -> JSONResponse:
    body = {"type": "about:blank", "title": code, "status": status, "request_id": request_id.get()}
    if detail:
        body["detail"] = detail
    return JSONResponse(body | extra, status_code=status, media_type="application/problem+json")


def code_for(status: int) -> str:
    """404 -> "not_found", 405 -> "method_not_allowed", and so on."""
    try:
        return HTTPStatus(status).phrase.lower().replace(" ", "_").replace("-", "_")
    except ValueError:
        return "error"


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)  # noqa: S101
    return problem(exc.status, exc.code, exc.detail, **exc.extra)


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)  # noqa: S101
    detail = exc.detail if isinstance(exc.detail, str) and exc.detail != HTTPStatus(exc.status_code).phrase else None
    return problem(exc.status_code, code_for(exc.status_code), detail)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # noqa: S101
    errors = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
    return problem(422, "validation_error", errors=errors)


def install(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(HTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
