"""Child play on the server (spec §7, §13): access settings, play check runs, tries, skill levels, game choice."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child
from app.modules.play.models import AccessProfile, InputMode
from app.schemas import ApiModel

router = APIRouter(prefix="/children", tags=["play"])


class AccessSettings(ApiModel):
    """The five access settings the play check finds (spec §7). Values outside the spec's ranges are refused."""

    input_mode: InputMode
    min_target_mm: int = Field(ge=12, le=100)  # never below 12
    dwell_ms: int = Field(ge=500, le=3000)
    repeat_lock: bool
    release_ok: bool


@router.get("/{child_id}/access")
async def get_access(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> AccessSettings:
    """The child's access settings; 404 no_access_settings before the play check found them."""
    await get_visible_child(db, user, child_id)
    row = await db.get(AccessProfile, child_id)
    if row is None:
        raise AppError(404, "no_access_settings")
    return AccessSettings.model_validate(row, from_attributes=True)


@router.put("/{child_id}/access")
async def save_access(
    child_id: uuid.UUID, body: AccessSettings, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> AccessSettings:
    """Save what the play check found (or what an adult corrected). Every game reads them."""
    await get_visible_child(db, user, child_id)
    values = body.model_dump()
    stmt = insert(AccessProfile).values(child_id=child_id, **values)
    await db.execute(stmt.on_conflict_do_update(index_elements=[AccessProfile.child_id], set_=values))
    await db.commit()
    return body
