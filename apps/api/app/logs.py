"""Logging with a request number in every line, and one line per request."""

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.errors import problem, request_id

log = logging.getLogger("app")


def setup() -> None:
    base_factory = logging.getLogRecordFactory()

    def factory(*args: object, **kwargs: object) -> logging.LogRecord:
        record = base_factory(*args, **kwargs)
        record.request_id = request_id.get()
        return record

    logging.setLogRecordFactory(factory)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")


def install(app: FastAPI) -> None:
    """Give each request a number (or keep the caller's X-Request-ID), log it, and send it back in X-Request-ID."""

    @app.middleware("http")
    async def with_request_id(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        rid = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex
        request_id.set(rid)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error")
            response = problem(500, "internal_error")
        ms = (time.perf_counter() - start) * 1000
        log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code, ms)
        response.headers["X-Request-ID"] = rid
        return response
