"""Child play on the server (spec §7, §13): access settings, play check runs, tries, skill levels, game choice."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child
from app.modules.play import skill, tries
from app.modules.play.models import (
    AccessProfile,
    GameSession,
    Hint,
    InputMode,
    Outcome,
    PlayCheckRun,
    RunStatus,
    SkillArea,
    SkillLevel,
    Try,
)
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


# ---------------------------------------------------------------- play check runs


class RunOut(ApiModel):
    id: uuid.UUID
    status: RunStatus
    stage: int
    helped_by_adult: bool
    started_at: datetime
    finished_at: datetime | None


class RunChange(ApiModel):
    status: RunStatus | None = None
    stage: int | None = Field(default=None, ge=1, le=2)
    helped_by_adult: bool | None = None


def _run_out(r: PlayCheckRun) -> RunOut:
    return RunOut(
        id=r.id,
        status=r.status,
        stage=r.stage,
        helped_by_adult=r.helped_by_adult,
        started_at=r.created_at,
        finished_at=r.finished_at,
    )


@router.post("/{child_id}/play-check", status_code=201)
async def start_run(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> RunOut:
    """Start a play check (again: a stopped one may be retried, spec §7)."""
    await get_visible_child(db, user, child_id)
    run = PlayCheckRun(child_id=child_id, status=RunStatus.open, stage=1, helped_by_adult=False)
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return _run_out(run)


@router.get("/{child_id}/play-check")
async def latest_run(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> RunOut:
    """The latest play check; 404 no_play_check before the first one."""
    await get_visible_child(db, user, child_id)
    run = await db.scalar(
        select(PlayCheckRun).where(PlayCheckRun.child_id == child_id).order_by(PlayCheckRun.created_at.desc()).limit(1)
    )
    if run is None:
        raise AppError(404, "no_play_check")
    return _run_out(run)


@router.patch("/{child_id}/play-check/{run_id}")
async def change_run(
    child_id: uuid.UUID,
    run_id: uuid.UUID,
    body: RunChange,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> RunOut:
    """Next stage, the parent helped, stopped (upset or tired) or finished. A closed run cannot be opened again."""
    await get_visible_child(db, user, child_id)
    run = await db.get(PlayCheckRun, run_id)
    if run is None or run.child_id != child_id:
        raise AppError(404, "not_found")
    if run.status != RunStatus.open:
        raise AppError(409, "play_check_closed")
    if body.stage is not None:
        run.stage = body.stage
    if body.helped_by_adult is not None:
        run.helped_by_adult = body.helped_by_adult
    if body.status is not None and body.status != RunStatus.open:
        run.status = body.status
        run.finished_at = datetime.now(UTC)
    await db.commit()
    return _run_out(run)


# ---------------------------------------------------------------- tries


class TryIn(ApiModel):
    """One try, as the website records it (lib/tries.ts, spec §7)."""

    id: uuid.UUID  # made by the device: a batch sent twice is stored once
    ts: datetime
    session_id: str | None = None
    game: str = Field(max_length=32)
    level: int = Field(ge=0, le=100)
    item_id: str = Field(max_length=64)
    input_mode: InputMode
    outcome: Outcome
    attempts: int = Field(ge=1, le=100)
    hint_shown: Hint
    access_event: bool
    helped_by_adult: bool
    response_ms: int | None = Field(default=None, ge=0)


class TriesStored(ApiModel):
    stored: int  # new tries; the rest were already there or too old to keep


@router.post("/{child_id}/tries")
async def save_tries(
    child_id: uuid.UUID,
    body: Annotated[list[TryIn], Field(max_length=500)],
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> TriesStored:
    """A batch of tries, sent when the device is online. Tries older than 90 days are not kept. Every new clean try
    moves θ of its area (Elo, spec §13); an access event never does (product rule 5)."""
    await get_visible_child(db, user, child_id)
    now = datetime.now(UTC)
    keep = [t for t in body if now - timedelta(days=tries.KEEP_DAYS) <= t.ts <= now + timedelta(days=1)]
    if not keep:
        return TriesStored(stored=0)
    for month in {date(t.ts.year, t.ts.month, 1) for t in keep}:
        await tries.add_month(db, month)
    sessions = {str(s) for s in await db.scalars(select(GameSession.id).where(GameSession.child_id == child_id))}
    rows = [
        {
            **t.model_dump(exclude={"session_id"}),
            "child_id": child_id,
            "session_id": uuid.UUID(t.session_id) if t.session_id in sessions else None,
        }
        for t in keep
    ]
    added = set(
        await db.scalars(insert(Try).values(rows).on_conflict_do_nothing(index_elements=["id", "ts"]).returning(Try.id))
    )
    clean = [t for t in keep if t.id in added and not t.access_event and t.outcome != Outcome.skipped]
    await _move_skills(db, child_id, clean)
    await db.commit()
    return TriesStored(stored=len(added))


async def _move_skills(db: AsyncSession, child_id: uuid.UUID, clean: list[TryIn]) -> None:
    levels = {s.area: s for s in await db.scalars(select(SkillLevel).where(SkillLevel.child_id == child_id))}
    for t in sorted(clean, key=lambda x: x.ts):
        area = skill.AREA_OF.get(t.game)
        if area is None:
            continue
        row = levels.get(SkillArea(area))
        if row is None:
            row = levels[SkillArea(area)] = SkillLevel(child_id=child_id, area=SkillArea(area), theta=0.0, n_trials=0)
            db.add(row)
        row.theta = skill.elo(row.theta, row.n_trials, skill.difficulty(t.level), t.outcome == Outcome.correct)
        row.n_trials += 1
