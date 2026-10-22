"""The child's 4-week plan: what to do on each of the 28 days, and why (spec §7).

Same shape as the website's roadmap (apps/web/src/lib/roadmap.ts, roadmap_cases.json): days with exercises (an
exercise id and a level) and games (a game kind and minutes), plus the reasons behind each choice. Plans are never
changed or deleted when a new one is made; the newest is the current one, the older ones are the child's history.
"""

import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.modules.accounts.models import enum_column


class Plan(IdTimeMixin, Base):
    __tablename__ = "plans"

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    # The question round it was built from (A4.4); empty if that round is ever gone.
    round_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("intake_rounds.id", ondelete="SET NULL"))
    start_date: Mapped[date] = mapped_column(Date)
    # Which version of the plan engine made it, so an old plan can always be explained and rebuilt the same way.
    engine_version: Mapped[str] = mapped_column(String(16))
    # False when nothing is safe enough without a therapist: the plan has games only (roadmap.ts exercisesAllowed).
    exercises_allowed: Mapped[bool]


class ItemKind(StrEnum):
    exercise = "exercise"
    game = "game"


class PlanItem(IdTimeMixin, Base):
    """One thing to do on one day. Exercises have a level, games have minutes."""

    __tablename__ = "plan_items"
    __table_args__ = (
        Index("ix_plan_items_plan_id_day", "plan_id", "day"),
        CheckConstraint("day between 0 and 27", name="day"),
        CheckConstraint(
            "(kind = 'exercise' and level is not null and minutes is null)"
            " or (kind = 'game' and minutes is not null and level is null)",
            name="level_or_minutes",
        ),
    )

    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"))
    day: Mapped[int] = mapped_column(SmallInteger)  # 0 = start_date, 27 = the last day
    position: Mapped[int] = mapped_column(SmallInteger)  # order within the day and kind
    kind: Mapped[ItemKind] = mapped_column(enum_column(ItemKind))
    ref: Mapped[str] = mapped_column(String(48))  # exercise id (exercises table) or game kind
    level: Mapped[int | None] = mapped_column(SmallInteger)
    minutes: Mapped[int | None] = mapped_column(SmallInteger)


class PlanReason(IdTimeMixin, Base):
    """Why something is in the plan: which goal it serves, at which level (shown to parents, spec §7)."""

    __tablename__ = "plan_reasons"

    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(SmallInteger)
    slot: Mapped[ItemKind] = mapped_column(enum_column(ItemKind))
    goal: Mapped[str] = mapped_column(String(16))
    ref: Mapped[str] = mapped_column(String(48))
    level: Mapped[int] = mapped_column(SmallInteger)
    source: Mapped[str | None] = mapped_column(String(300))  # A4.6: "KB-HAND-02: Novak et al., 2020" for an AI pick


class FixedLevel(IdTimeMixin, Base):
    """A level a therapist set for one exercise of one child. The parent's easy / hard ratings no longer move it
    (spec §8). Set through the therapist form (A8.2)."""

    __tablename__ = "fixed_levels"
    __table_args__ = (
        UniqueConstraint("child_id", "exercise_id"),
        CheckConstraint("level between 1 and 3", name="level"),
    )

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"))
    level: Mapped[int] = mapped_column(SmallInteger)
    fixed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
