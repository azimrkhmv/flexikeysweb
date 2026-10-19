"""A11.1: the Home Kit box, ordered by the family's owner, by courier or pickup; our team moves the order from placed
to delivered. Placeholder price and items until G3."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from app.modules.kits.router import load_kits
from tests.test_admin_changes import make
from tests.test_children import API, add_child, add_helper, parent
from tests.test_places_admin import PLACE
from tests.test_videos_register import run, title

ORDERS = f"{API}/family/kit-orders"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        run(c, load_kits)
        yield c


def courier(child: str, **extra: Any) -> dict[str, Any]:
    return {
        "productSlug": "standard", "childId": child, "delivery": "courier", "region": "tashkent_city",
        "district": "Chilonzor", "address": "Bunyodkor 1, kv 5", "phone": "+998 90 123 45 67", **extra,
    }  # fmt: skip


def test_an_order_goes_from_placed_to_delivered(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    (kit,) = client.get(f"{API}/kits", headers=owner).json()
    assert kit["slug"] == "standard" and kit["priceSom"] > 0 and "putty" in kit["items"]

    made = client.post(ORDERS, headers=owner, json=courier(child))
    assert made.status_code == 201, made.text
    order = made.json()
    assert (order["status"], order["phone"], order["priceSom"]) == ("placed", "+998901234567", kit["priceSom"])
    helper = add_helper(client, owner)
    assert [o["id"] for o in client.get(ORDERS, headers=helper).json()] == [order["id"]]  # the family sees it

    _, admin, _ = make(client, Role.admin)
    assert order["id"] in [o["id"] for o in client.get(f"{API}/admin/kit-orders", headers=admin).json()]
    url = f"{API}/admin/kit-orders/{order['id']}"
    assert title(client.patch(url, headers=admin, json={"status": "delivered"})) == (409, "invalid_status_change")
    for step in ("confirmed", "shipped", "delivered"):
        assert client.patch(url, headers=admin, json={"status": step}).json()["status"] == step
    assert title(client.patch(url, headers=admin, json={"status": "cancelled"})) == (409, "invalid_status_change")
    assert title(client.post(f"{ORDERS}/{order['id']}/cancel", headers=owner)) == (409, "too_late")


def test_what_an_order_needs(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    assert title(client.post(ORDERS, headers=owner, json=courier(child, address=" "))) == (422, "address_needed")
    assert title(client.post(ORDERS, headers=owner, json=courier(child, phone="12"))) == (422, "invalid_phone")
    assert title(client.post(ORDERS, headers=owner, json=courier(child, district="Nowhere"))) == (
        422,
        "invalid_district",
    )
    assert title(client.post(ORDERS, headers=owner, json=courier(child, productSlug="gold"))) == (422, "unknown_kit")
    pickup = courier(child, delivery="pickup", address=None)
    assert title(client.post(ORDERS, headers=owner, json=pickup)) == (422, "unknown_place")
    _, admin, _ = make(client, Role.admin)
    place = client.post(f"{API}/admin/places", headers=admin, json=PLACE).json()
    made = client.post(ORDERS, headers=owner, json={**pickup, "pickupPlaceId": place["id"]}).json()
    assert (made["delivery"], made["pickupPlaceId"], made["address"]) == ("pickup", place["id"], None)
    # The owner cancels while it is still placed.
    assert client.post(f"{ORDERS}/{made['id']}/cancel", headers=owner).json()["status"] == "cancelled"


def test_only_the_owner_orders_for_their_own_child(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    helper = add_helper(client, owner)
    assert title(client.post(ORDERS, headers=helper, json=courier(child))) == (403, "owner_only")
    stranger = parent(client)
    add_child(client, stranger)
    assert title(client.post(ORDERS, headers=stranger, json=courier(child))) == (404, "not_found")
    order = client.post(ORDERS, headers=owner, json=courier(child)).json()
    assert title(client.post(f"{ORDERS}/{order['id']}/cancel", headers=stranger)) == (404, "not_found")
    assert client.get(ORDERS, headers=stranger).json() == []
    assert title(client.get(f"{API}/admin/kit-orders", headers=owner)) == (403, "forbidden")
