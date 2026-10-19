"""Your data (A12.1): everything stored about a child, in one file the owner can read and keep.

The file is built from the database's own description: every table with a `child_id`, and every table that hangs
off one of those (a round's answers, a plan's items, a chat's messages, a clip's replies). A table added later is in
the file without changing this code. Encrypted health answers and chat texts are written out readable.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import Table, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models  # noqa: F401  # every table must be known here, also those no address imports yet
from app.crypto import decrypt_json
from app.db import Base, get_session
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child, require_owner

router = APIRouter(prefix="/children", tags=["your data"])


def child_tables() -> list[tuple[Table, Table | None]]:
    """(table, parent): tables with a child_id (parent None), then the tables that point at one of them."""
    direct = [t for t in Base.metadata.sorted_tables if "child_id" in t.c]
    nested: list[tuple[Table, Table | None]] = [
        (t, parent)
        for t in Base.metadata.sorted_tables
        if "child_id" not in t.c
        for parent in direct
        if any(fk.column.table is parent for fk in t.foreign_keys)
    ]
    return [(t, None) for t in direct] + nested  # parents first: their ids select the nested rows


def _readable(row: dict[str, Any]) -> dict[str, Any]:
    for k, v in list(row.items()):
        if (k == "secret" or k.endswith("_secret")) and isinstance(v, str):
            row[k.removesuffix("_secret") if k != "secret" else "decrypted"] = decrypt_json(v)
            del row[k]
    return row


@router.get("/{child_id}/export")
async def export(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> JSONResponse:
    """Owner only. A JSON file with the child and, per table, every row about them."""
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    data: dict[str, Any] = {"exportedAt": datetime.now(UTC), "child": {}, "tables": {}}
    data["child"] = dict(
        (
            await db.execute(
                select(Base.metadata.tables["children"]).where(Base.metadata.tables["children"].c.id == child_id)
            )
        )
        .mappings()
        .one()
    )
    ids: dict[str, list[Any]] = {}
    for table, parent in child_tables():
        if parent is None:
            stmt = select(table).where(table.c.child_id == child_id)
        else:
            fk = next(fk for fk in table.foreign_keys if fk.column.table is parent)
            stmt = select(table).where(fk.parent.in_(ids.get(parent.name, [])))
        rows = [_readable(dict(r)) for r in (await db.execute(stmt)).mappings()]
        ids[table.name] = [r["id"] for r in rows if "id" in r]
        data["tables"][table.name] = rows
    audit.record(db, user.id, "child.exported", child_id)
    await db.commit()
    name = f"flexikeys-{child.name}-{datetime.now(UTC).date()}.json"
    return JSONResponse(jsonable_encoder(data), headers={"Content-Disposition": f'attachment; filename="{name}"'})
