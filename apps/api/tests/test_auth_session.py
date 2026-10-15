"""A1.4: cookie sign-in for the website, header tokens for the app, the CSRF check, refresh and sign-out."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app

AUTH = "/api/v1/auth"
WEB = {"X-Auth-Transport": "cookie"}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def sign_in(client: TestClient, phone: str, headers: dict[str, str] | None = None) -> dict[str, object]:
    code = client.post(f"{AUTH}/phone/start", json={"phone": phone}).json()["demoCode"]
    r = client.post(f"{AUTH}/phone/verify", json={"phone": phone, "code": code}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()  # type: ignore[no-any-return]


def csrf(client: TestClient) -> dict[str, str]:
    return WEB | {"X-CSRF-Token": client.cookies["fk_csrf"]}


# --- website: cookies ---


def test_website_gets_cookies_and_no_tokens_in_the_body(client: TestClient) -> None:
    body = sign_in(client, "+998912000001", WEB)
    assert "accessToken" not in body and "refreshToken" not in body
    assert {"fk_access", "fk_refresh", "fk_csrf"} <= set(client.cookies.keys())


def test_website_write_with_the_csrf_token_works(client: TestClient) -> None:
    sign_in(client, "+998912000002", WEB)
    assert client.post(f"{AUTH}/logout-all", headers=csrf(client)).status_code == 204


def test_website_write_without_the_csrf_token_is_refused(client: TestClient) -> None:
    sign_in(client, "+998912000003", WEB)
    r = client.post(f"{AUTH}/logout-all", headers=WEB)
    assert (r.status_code, r.json()["title"]) == (403, "csrf_failed")
    r = client.post(f"{AUTH}/logout-all", headers=WEB | {"X-CSRF-Token": "guess"})
    assert (r.status_code, r.json()["title"]) == (403, "csrf_failed")


def test_website_refresh_swaps_the_cookies(client: TestClient) -> None:
    sign_in(client, "+998912000004", WEB)
    old = client.cookies["fk_refresh"]
    r = client.post(f"{AUTH}/refresh", headers=csrf(client))
    assert r.status_code == 200
    assert r.json() == {}
    assert client.cookies["fk_refresh"] != old


def test_website_refresh_without_csrf_is_refused(client: TestClient) -> None:
    sign_in(client, "+998912000005", WEB)
    assert client.post(f"{AUTH}/refresh", headers=WEB).status_code == 403


def test_website_sign_out_ends_this_session(client: TestClient) -> None:
    sign_in(client, "+998912000006", WEB)
    old_refresh = client.cookies["fk_refresh"]
    assert client.post(f"{AUTH}/logout", headers=csrf(client)).status_code == 204
    assert "fk_access" not in client.cookies
    client.cookies.set("fk_refresh", old_refresh, path="/api/v1/auth/")
    client.cookies.set("fk_csrf", "x")
    r = client.post(f"{AUTH}/refresh", headers=WEB | {"X-CSRF-Token": "x"})
    assert (r.status_code, r.json()["title"]) == (401, "invalid_token")


# --- app: header tokens ---


def test_app_gets_tokens_in_the_body_and_uses_the_header(client: TestClient) -> None:
    body = sign_in(client, "+998912000010")
    assert not client.cookies  # nothing for the app in cookies
    bearer = {"Authorization": f"Bearer {body['accessToken']}"}
    assert client.post(f"{AUTH}/logout-all", headers=bearer).status_code == 204  # no CSRF needed for the app


def test_app_refresh_with_the_body(client: TestClient) -> None:
    body = sign_in(client, "+998912000011")
    r = client.post(f"{AUTH}/refresh", json={"refreshToken": body["refreshToken"]})
    assert r.status_code == 200
    assert r.json()["refreshToken"] != body["refreshToken"]
    assert r.json()["accessToken"]


def test_no_token_at_all(client: TestClient) -> None:
    assert client.post(f"{AUTH}/logout-all").status_code == 401
    assert client.post(f"{AUTH}/logout-all", headers={"Authorization": "Bearer forged"}).status_code == 401


def test_sign_out_everywhere_stops_old_access_tokens_too(client: TestClient) -> None:
    phone = sign_in(client, "+998912000012")
    bearer = {"Authorization": f"Bearer {phone['accessToken']}"}
    assert client.post(f"{AUTH}/logout-all", headers=bearer).status_code == 204
    assert client.post(f"{AUTH}/logout-all", headers=bearer).status_code == 401
    r = client.post(f"{AUTH}/refresh", json={"refreshToken": phone["refreshToken"]})
    assert r.status_code == 401
