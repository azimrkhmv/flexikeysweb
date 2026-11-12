"""The progress panel (games spec 8 Nov 2026 §8, B89): a level 1-100 per skill area, its last 8 weeks and what the
child can do now and 4 weeks ago. For the family and for a therapist the child is shared with (who also sees the
tries, access events and open tier). Never a percentage, never a comparison with other children (product rule 1)."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child
from app.modules.play import skill
from app.modules.play.models import SkillArea, SkillLevel, SkillSnapshot, Try
from app.modules.play.router import speed_is_open, tier_tops
from app.modules.therapists.router import get_shared_child
from app.schemas import ApiModel

router = APIRouter(prefix="/children", tags=["play"])
therapist_router = APIRouter(prefix="/therapist", tags=["play"])

# The areas people see, in this order: access never (it is a setting), speed only while open (§8.1).
SHOWN_AREAS = ("attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed")
THERAPIST_DAYS = 28  # the tries and access events a therapist sees: the last 4 weeks


def _kinds(area: str) -> list[str]:
    return [k for k, a in skill.AREA_OF.items() if a == area]


# ---------------------------------------------------------------- the answer


class StepRef(ApiModel):
    """A skill-game step; the website shows its "can do" sentence (content/skillGames.ts) in the reader's language."""

    activity_id: str
    tier: int
    step: int


class WeekLevel(ApiModel):
    week_start: date  # Monday, Tashkent time
    level: int | None  # None: no games yet that week, or under 10 clean tries


class AreaProgress(ApiModel):
    area: SkillArea
    level: int | None  # 1-100 from θ, the same θ the plan reads; None = "Not enough games yet" (under 10 clean tries)
    best: int | None  # the highest level ever shown: the child's tree grows from it and never shrinks (§8.5)
    weeks: list[WeekLevel]  # the last 8 weeks, oldest first, this week last
    now: StepRef | None  # the hardest step done well lately
    before: StepRef | None  # ... and 4 weeks ago
    top_tier: int  # the highest open tier, 1 (Seed) to 4 (Summit)


class ProgressOut(ApiModel):
    areas: list[AreaProgress]  # access never; speed only while it is open for this child


class TherapistAreaProgress(AreaProgress):
    tries: int  # all tries of the area in the last 4 weeks ...
    access_events: int  # ... and how many of them were access events (left out of the level, rule 5)


class TherapistProgressOut(ApiModel):
    areas: list[TherapistAreaProgress]


async def _areas(db: AsyncSession, child_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = {r.area.value: r for r in await db.scalars(select(SkillLevel).where(SkillLevel.child_id == child_id))}
    snaps: dict[str, list[dict[str, Any]]] = {}
    for s in await db.scalars(select(SkillSnapshot).where(SkillSnapshot.child_id == child_id)):
        top = (
            {"activity_id": s.top_activity_id, "tier": s.top_tier, "step": s.top_step}
            if s.top_activity_id and s.top_tier and s.top_step
            else None
        )
        snaps.setdefault(s.area.value, []).append(
            {"week_start": s.week_start, "theta": s.theta, "n": s.n_trials, "top": top}
        )
    tops = await tier_tops(db, child_id)
    this_week = skill.week_start(datetime.now(UTC))
    speed = await speed_is_open(db, child_id)
    out = []
    for area in SHOWN_AREAS:
        if area == "speed" and not speed:
            continue
        row = rows.get(area)
        mine = snaps.get(area, [])
        level = skill.shown_level(row.theta, row.n_trials) if row else None
        h = skill.history(mine, this_week)
        latest = skill.snapshot_at(mine, this_week)
        out.append(
            {
                "area": SkillArea(area),
                "level": level,
                "best": skill.best_level(mine, level),
                "weeks": h["weeks"],
                "now": latest["top"] if latest else None,
                "before": h["before"],
                "top_tier": tops[area],
            }
        )
    return out


@router.get("/{child_id}/progress")
async def get_progress(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> ProgressOut:
    """The progress panel for the family (§8.3): per shown area, the level now, the last 8 weeks and what the child
    can do now and 4 weeks ago."""
    await get_visible_child(db, user, child_id)
    return ProgressOut.model_validate({"areas": await _areas(db, child_id)})


@therapist_router.get("/children/{child_id}/progress")
async def get_therapist_progress(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> TherapistProgressOut:
    """The same for a therapist the child is shared with (§8.4), plus each area's tries and access events of the
    last 4 weeks and its open tier. 404 for anyone else."""
    await get_shared_child(db, user, child_id)
    areas = await _areas(db, child_id)
    since = datetime.now(UTC) - timedelta(days=THERAPIST_DAYS)
    counts = {
        game: (int(n), int(events or 0))
        for game, n, events in await db.execute(
            select(Try.game, func.count(), func.count().filter(Try.access_event.is_(True)))
            .where(Try.child_id == child_id, Try.ts >= since)
            .group_by(Try.game)
        )
    }
    for a in areas:
        mine = [counts.get(k, (0, 0)) for k in _kinds(a["area"].value)]
        a["tries"] = sum(n for n, _ in mine)
        a["access_events"] = sum(e for _, e in mine)
    return TherapistProgressOut.model_validate({"areas": areas})
