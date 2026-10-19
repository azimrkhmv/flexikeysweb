"""Your data (A12.1): everything stored about a child, in one file the owner can read and keep.

The file is built from the database's own description: every table with a `child_id`, and every table that hangs
off one of those (a round's answers, a plan's items, a chat's messages, a clip's replies). A table added later is in
the file without changing this code. Encrypted health answers and chat texts are written out readable.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import Table, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import (
    models,  # noqa: F401  # every table must be known here, also those no address imports yet
    storage,
)
from app.crypto import decrypt_json
from app.db import Base, get_session
from app.errors import AppError
from app.modules.accounts.models import Family, FamilyMember, MemberRole, Role
from app.modules.audit import models as audit
from app.modules.auth import session
from app.modules.auth.session import CurrentUser
from app.modules.children.models import Child
from app.modules.children.router import forget_files, get_visible_child, require_owner
from app.modules.privacy.models import StorageCleanup

router = APIRouter(prefix="/children", tags=["your data"])
me_router = APIRouter(prefix="/me", tags=["your data"])


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


@me_router.delete("", status_code=204)
async def delete_account(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> Response:
    """A parent deletes their account: their own family, its children with everything about them, and the account
    itself, at once; the files follow overnight. Helping in another family ends too. Staff and therapist accounts
    are closed by an admin (403 ask_admin)."""
    if user.role != Role.parent:
        raise AppError(403, "ask_admin")
    family_id = await db.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user.id, FamilyMember.role == MemberRole.owner)
    )
    if family_id is not None:
        for child_id in await db.scalars(select(Child.id).where(Child.family_id == family_id)):
            forget_files(db, child_id)
        await db.execute(delete(Child).where(Child.family_id == family_id))
        await db.execute(delete(Family).where(Family.id == family_id))
    audit.record(db, None, "user.deleted", user.id)
    await db.delete(user)
    await db.commit()
    response = Response(status_code=204)
    session.clear(response)
    return response


async def purge_files(db: AsyncSession) -> int:
    """The nightly cleanup: remove the files of deleted children; returns how many files went."""
    removed = 0
    for job in list(await db.scalars(select(StorageCleanup))):
        removed += storage.remove_prefix(job.prefix)
        await db.delete(job)
        await db.commit()  # one prefix at a time: a crash halfway redoes only what is left
    return removed
