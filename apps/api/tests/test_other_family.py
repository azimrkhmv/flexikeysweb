"""A2.8: someone from family B tries every child address with family A's child, and always gets "not found".

The addresses come from the server's own description (openapi.json), so a new child address is tried without
changing this test. A new kind of body or path part fails here until it gets an example below.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app
from tests.test_children import API, add_child, client, parent  # noqa: F401 (client is a fixture)
from tests.test_intake_save import save, saved

BODIES = {
    "ChildChange": {"name": "X"},
    "ConsentChange": {"granted": True},
    "AnswersIn": {"answers": {}},
    "DoneIn": {"day": 0, "exerciseId": "putty_squeeze"},
    "FeelingIn": {"feeling": "easy"},
    "DailyIn": {"questionId": "D1", "value": 2},
    "RunChange": {"stage": 2},
    "UploadKind": {"kind": "photo"},
    "CardIn": {"category": "food", "label": "Non", "emoji": "x"},
    "CardChange": {"label": "X"},
    "TherapistInvite": {},
    "FormIn": {"answers": {}},
    "ClipIn": {"kind": "movement", "storageKey": "x"},
    "ReplyIn": {"text": "x"},
    "SessionChange": {"secondsPlayed": 10},
    "Placement": {"buckets": {"memory": "yes"}},
    "TryIn": {
        "id": str(uuid.uuid4()),
        "ts": "2026-10-18T10:00:00Z",
        "game": "find_same",
        "level": 1,
        "itemId": "x",
        "inputMode": "touch",
        "outcome": "correct",
        "attempts": 1,
        "hintShown": "none",
        "accessEvent": False,
        "helpedByAdult": False,
    },
    "AccessSettings": {
        "inputMode": "touch",
        "minTargetMm": 20,
        "dwellMs": 1000,
        "repeatLock": False,
        "releaseOk": True,
    },
}
PARTS = {
    "kind": "health",
    "number": "1",
    "card_id": str(uuid.uuid4()),
    "clip_id": str(uuid.uuid4()),
    "done_id": str(uuid.uuid4()),
    "link_id": str(uuid.uuid4()),
    "run_id": str(uuid.uuid4()),
    "session_id": str(uuid.uuid4()),
}


def child_addresses() -> list[tuple[str, str, object]]:
    found = []
    for path, methods in app.openapi()["paths"].items():
        if "{child_id}" not in path:
            continue
        for method, op in methods.items():
            schema = op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            ref = schema.get("$ref") or schema.get("items", {}).get("$ref")
            body = BODIES[ref.rsplit("/", 1)[1]] if ref else None
            found.append((method.upper(), path, [body] if "items" in schema else body))
    return found


def test_another_family_always_gets_not_found(client: TestClient) -> None:  # noqa: F811
    owner = parent(client)
    child = add_child(client, owner)
    # Real data behind every address, so a "not found" can only come from the family check.
    assert save(client, owner, child, {"P1": "Ali"}).status_code == 200
    stranger = parent(client)
    add_child(client, stranger, name="Own")  # family B has its own child

    addresses = child_addresses()
    assert len(addresses) >= 10  # sanity: the description really lists the child addresses
    for method, path, body in addresses:
        for child_id in (child, str(uuid.uuid4())):  # A's child answers exactly like a child that does not exist
            url = API + path.removeprefix(API).replace("{child_id}", child_id).format(**PARTS)
            r = client.request(method, url, headers=stranger, json=body)
            assert (r.status_code, r.json()["title"]) == (404, "not_found"), (method, path, r.text)

    # And nothing changed for family A.
    got = client.get(f"{API}/children/{child}", headers=owner)
    assert (got.status_code, got.json()["name"]) == (200, "Ali")
    assert saved(client, owner, child) == {"P1": "Ali"}
    assert not any(client.get(f"{API}/children/{child}/consents", headers=owner).json().values())
