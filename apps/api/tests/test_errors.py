import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import errors, logs
from app.errors import AppError


def make_app() -> FastAPI:
    app = FastAPI()
    errors.install(app)
    logs.install(app)

    @app.get("/taken")
    async def taken() -> None:
        raise AppError(409, "phone_taken", "This phone number is already registered.")

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("bug")

    @app.get("/number/{n}")
    async def number(n: int) -> int:
        return n

    return app


client = TestClient(make_app(), raise_server_exceptions=False)


def test_app_error_is_problem_json_with_code_in_title() -> None:
    r = client.get("/taken")
    assert r.status_code == 409
    assert r.headers["content-type"] == "application/problem+json"
    body = r.json()
    assert body["title"] == "phone_taken"
    assert body["status"] == 409
    assert body["detail"] == "This phone number is already registered."
    assert body["request_id"] == r.headers["x-request-id"]


def test_unknown_address_is_not_found() -> None:
    r = client.get("/nowhere")
    assert (r.status_code, r.json()["title"]) == (404, "not_found")


def test_bad_input_lists_the_fields() -> None:
    r = client.get("/number/abc")
    assert (r.status_code, r.json()["title"]) == (422, "validation_error")
    assert r.json()["errors"][0]["field"] == "path.n"


def test_crash_is_a_plain_500_without_details() -> None:
    r = client.get("/boom")
    assert (r.status_code, r.json()["title"]) == (500, "internal_error")
    assert "bug" not in r.text


def test_request_number_is_kept_and_in_every_log_line(caplog: pytest.LogCaptureFixture) -> None:
    logs.setup()
    with caplog.at_level(logging.INFO):
        r = client.get("/taken", headers={"X-Request-ID": "abc123"})
    assert r.headers["x-request-id"] == "abc123"
    lines = [rec for rec in caplog.records if rec.name == "app"]
    assert lines
    assert all(getattr(rec, "request_id", None) == "abc123" for rec in lines)
