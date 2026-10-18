"""Daily use (spec §10, §8 "Parent feedback"): what was done each day and how it went, paused days, and the one
daily question with its answers.

A paused day is not missed: the plan moves forward one day (A5.4). Done records point at the plan item, so they
stay right however the plan's days are shifted by pauses.
"""

import uuid
from datetime import date
from enum import StrEnum
from typing import Any

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin, TimeMixin
from app.modules.accounts.models import enum_column


class Feeling(StrEnum):
    """The parent's optional answer after Done (spec §8). Two "hard" in a row lower the level, two "easy" raise it."""

    easy = "easy"
    ok = "ok"
    hard = "hard"


class TaskDone(IdTimeMixin, Base):
    """One exercise or game of the plan marked done."""

    __tablename__ = "tasks_done"
    __table_args__ = (UniqueConstraint("plan_item_id"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    plan_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plan_items.id", ondelete="CASCADE"))
    done_on: Mapped[date] = mapped_column(Date)  # the Tashkent date it was done
    feeling: Mapped[Feeling | None] = mapped_column(enum_column(Feeling))  # empty until the parent says
    done_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class PausedDay(IdTimeMixin, Base):
    """A day the parent paused because the child was sick or very tired."""

    __tablename__ = "paused_days"
    __table_args__ = (UniqueConstraint("plan_id", "paused_on"),)

    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"))
    paused_on: Mapped[date] = mapped_column(Date)  # Tashkent date
    paused_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class DailyQuestion(TimeMixin, Base):
    """One question of the daily list, for example "Did your child point to something they wanted today?".
    Never a health question. Loaded from a content file (A5.5)."""

    __tablename__ = "daily_questions"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # e.g. "D1"
    text: Mapped[dict[str, Any]] = mapped_column(JSONB)  # {"uz": ..., "ru": ..., "en": ...}
    options: Mapped[list[Any]] = mapped_column(JSONB)  # the allowed answers, each with its uz/ru/en label
    # The intake question whose answer it updates in the child's profile, if any (spec §10).
    updates: Mapped[str | None] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(default=True)  # false once it leaves the content file; kept for old answers


class DailyAnswer(IdTimeMixin, Base):
    """The answer to one day's question. One question a day per child."""

    __tablename__ = "daily_answers"
    __table_args__ = (UniqueConstraint("child_id", "asked_on"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    question_id: Mapped[str] = mapped_column(ForeignKey("daily_questions.id", ondelete="RESTRICT"))
    asked_on: Mapped[date] = mapped_column(Date)  # Tashkent date
    value: Mapped[Any] = mapped_column(JSONB(none_as_null=True), nullable=True)  # SQL NULL = "Not sure"
    answered_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
