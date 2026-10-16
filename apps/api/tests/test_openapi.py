"""A0.6: openapi.json, the description of every server address, is always current. The website builds its types
from it (apps/web `npm run typecheck`), so a changed address breaks the website's type check.

Changed an address? Run `UPDATE_OPENAPI=1 uv run pytest tests/test_openapi.py`, then `npm run typecheck` in apps/web.
"""

import json
import os
from pathlib import Path

from app.main import app

FILE = Path(__file__).parents[1] / "openapi.json"


def test_openapi_json_is_current() -> None:
    text = json.dumps(app.openapi(), indent=1, ensure_ascii=False) + "\n"
    if os.environ.get("UPDATE_OPENAPI"):
        FILE.write_text(text, "utf-8")
    assert FILE.read_text("utf-8") == text, (
        "openapi.json is stale: run UPDATE_OPENAPI=1 uv run pytest tests/test_openapi.py"
    )
