"""Child play on the server (spec §7, §13): access settings, play check runs, tries, skill levels, game choice."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child
from app.modules.intake.bridge import rules_view
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.play import skill, tries
from app.modules.play.models import (
    AccessProfile,
    GamePlayed,
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

TASHKENT = ZoneInfo("Asia/Tashkent")

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
    new = [t for t in keep if t.id in added]
    for game in {t.game for t in new}:  # first played, highest level tried: kept for good
        mine = [t for t in new if t.game == game]
        stmt = insert(GamePlayed).values(
            child_id=child_id,
            game=game,
            first_played=min(t.ts for t in mine).astimezone(TASHKENT).date(),
            top_level=max(t.level for t in mine),
        )
        await db.execute(
            stmt.on_conflict_do_update(
                index_elements=[GamePlayed.child_id, GamePlayed.game],
                set_={
                    "first_played": func.least(GamePlayed.first_played, stmt.excluded.first_played),
                    "top_level": func.greatest(GamePlayed.top_level, stmt.excluded.top_level),
                },
            )
        )
    clean = [t for t in new if not t.access_event and t.outcome != Outcome.skipped]
    await _move_skills(db, child_id, clean)
    await db.commit()
    return TriesStored(stored=len(added))


async def skill_rows(db: AsyncSession, child_id: uuid.UUID) -> dict[SkillArea, SkillLevel]:
    """All six areas. A missing one starts from the first guess: the ability answers of the latest finished intake
    round (spec §13, step 1). ponytail: a therapist's answers join here with A8.2 (they count twice)."""
    rows = {s.area: s for s in await db.scalars(select(SkillLevel).where(SkillLevel.child_id == child_id))}
    if len(rows) < len(skill.AREAS):
        last = await db.scalar(
            select(IntakeRound)
            .where(IntakeRound.child_id == child_id, IntakeRound.completed_at.is_not(None))
            .order_by(IntakeRound.number.desc())
            .limit(1)
        )
        plain = {
            q: v
            for q, v in await db.execute(
                select(IntakeAnswer.question_id, IntakeAnswer.value).where(
                    IntakeAnswer.round_id == (last.id if last else None)
                )
            )
        }  # the ability answers are never health answers, so the plain column has them
        answers = rules_view(last.questionnaire if last else "p41", plain, datetime.now(TASHKENT).date())
        for area in skill.AREAS:
            if SkillArea(area) not in rows:
                row = SkillLevel(child_id=child_id, area=SkillArea(area), theta=skill.starting_theta(area, answers))
                row.n_trials = 0
                rows[SkillArea(area)] = row
                db.add(row)
    return rows


async def _move_skills(db: AsyncSession, child_id: uuid.UUID, clean: list[TryIn]) -> None:
    levels = await skill_rows(db, child_id)
    for t in sorted(clean, key=lambda x: x.ts):
        area = skill.AREA_OF.get(t.game)
        if area is None:
            continue
        row = levels[SkillArea(area)]
        row.theta = skill.elo(row.theta, row.n_trials, skill.difficulty(t.level), t.outcome == Outcome.correct)
        row.n_trials += 1


# ---------------------------------------------------------------- skill levels


class SkillOut(ApiModel):
    area: SkillArea
    theta: float
    n_trials: int


class Placement(ApiModel):
    """The play check's stage 2: for each area played, can the child do it now (spec §7)."""

    buckets: dict[SkillArea, Literal["not_yet", "with_help", "yes"]]


@router.get("/{child_id}/skills")
async def get_skills(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[SkillOut]:
    """θ of the six areas, for choosing games. Never shown to parents as a score (product rule 1)."""
    await get_visible_child(db, user, child_id)
    rows = await skill_rows(db, child_id)
    await db.commit()
    return [SkillOut(area=a, theta=r.theta, n_trials=r.n_trials) for a, r in sorted(rows.items())]


@router.post("/{child_id}/skills/placement")
async def place(
    child_id: uuid.UUID, body: Placement, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[SkillOut]:
    """Correct the first guess with the play check: it wins over the intake by one step at most (spec §13, step 2)."""
    await get_visible_child(db, user, child_id)
    rows = await skill_rows(db, child_id)
    for area, bucket in body.buckets.items():
        rows[area].theta = skill.corrected(rows[area].theta, bucket)
    await db.commit()
    return [SkillOut(area=a, theta=r.theta, n_trials=r.n_trials) for a, r in sorted(rows.items())]


# ---------------------------------------------------------------- game sessions and game choice


async def seconds_today(db: AsyncSession, child_id: uuid.UUID) -> int:
    today = datetime.now(TASHKENT).date()
    total = await db.scalar(
        select(func.coalesce(func.sum(GameSession.seconds_played), 0)).where(
            GameSession.child_id == child_id, GameSession.day == today
        )
    )
    return int(total or 0)


class SessionOut(ApiModel):
    id: uuid.UUID
    day: date
    seconds_played: int
    seconds_left_today: int  # of the 20-minute daily limit


class SessionChange(ApiModel):
    seconds_played: int = Field(ge=0)  # this session's game time so far


async def _session_out(db: AsyncSession, s: GameSession) -> SessionOut:
    left = max(0, skill.GAME_LIMIT_S - await seconds_today(db, s.child_id))
    return SessionOut(id=s.id, day=s.day, seconds_played=s.seconds_played, seconds_left_today=left)


@router.post("/{child_id}/game-sessions", status_code=201)
async def start_session(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> SessionOut:
    """A sitting of play. 409 daily_limit once today's 20 minutes are played: the games sleep until tomorrow."""
    await get_visible_child(db, user, child_id)
    if await seconds_today(db, child_id) >= skill.GAME_LIMIT_S:
        raise AppError(409, "daily_limit")
    s = GameSession(child_id=child_id, day=datetime.now(TASHKENT).date(), seconds_played=0)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return await _session_out(db, s)


@router.patch("/{child_id}/game-sessions/{session_id}")
async def update_session(
    child_id: uuid.UUID,
    session_id: uuid.UUID,
    body: SessionChange,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> SessionOut:
    """The session's game time so far. It never goes back, and never beyond the time since the session started (plus
    a minute for clocks), so a device cannot fake more or less play."""
    await get_visible_child(db, user, child_id)
    s = await db.get(GameSession, session_id)
    if s is None or s.child_id != child_id:
        raise AppError(404, "not_found")
    elapsed = int((datetime.now(UTC) - s.created_at).total_seconds()) + 60
    s.seconds_played = max(s.seconds_played, min(body.seconds_played, elapsed))
    await db.commit()
    return await _session_out(db, s)


class GameOut(ApiModel):
    activity_id: str
    kind: str
    level: int


class SlotOut(ApiModel):
    slot: Literal["easy_win", "growth", "choice"]
    area: SkillArea | None
    games: list[GameOut]


class GamesOut(ApiModel):
    seconds_left_today: int
    slots: list[SlotOut]  # empty once today's 20 minutes are played


@router.get("/{child_id}/games")
async def choose(child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> GamesOut:
    """Today's games: an easy win, a growth game and the child's choice (spec §13). Open games are the levels up to
    one past the highest tried; at most one new kind of game a week; a game already played is never taken away."""
    await get_visible_child(db, user, child_id)
    left = max(0, skill.GAME_LIMIT_S - await seconds_today(db, child_id))
    if not left:
        return GamesOut(seconds_left_today=0, slots=[])
    played = {p.game: p for p in await db.scalars(select(GamePlayed).where(GamePlayed.child_id == child_id))}
    reach = max((p.top_level for p in played.values()), default=0) + 1
    unlocked = [g for g in skill.GAMES if g["level"] <= reach or g["kind"] in played]
    today = datetime.now(TASHKENT).date().isoformat()
    games = skill.weekly_new(unlocked, {k: p.first_played.isoformat() for k, p in played.items()}, today)
    theta = {a.value: r.theta for a, r in (await skill_rows(db, child_id)).items()}
    await db.commit()
    slots = [
        SlotOut(
            slot=s["slot"],
            area=s["area"],
            games=[GameOut(activity_id=g["activity_id"], kind=g["kind"], level=g["level"]) for g in s["games"]],
        )
        for s in skill.choose_games(theta, games)
    ]
    return GamesOut(seconds_left_today=left, slots=slots)
