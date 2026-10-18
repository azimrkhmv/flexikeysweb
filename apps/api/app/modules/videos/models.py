"""The exercise library and its videos (spec §8). A physiotherapist approves every video before any family sees it
(TASKS.md section 2, rule 3)."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    ColumnElement,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    and_,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin, TimeMixin
from app.modules.accounts.models import enum_column
from app.settings import settings


class Exercise(TimeMixin, Base):
    """One exercise, as in the website's exercises.json (apps/web/src/content/exercises.ts). Loaded by A3.3."""

    __tablename__ = "exercises"
    __table_args__ = (CheckConstraint("difficulty between 1 and 3", name="difficulty"),)

    id: Mapped[str] = mapped_column(String(48), primary_key=True)  # e.g. "putty_squeeze"; the plan refers to it
    title: Mapped[dict[str, Any]] = mapped_column(JSONB)  # {"uz": ..., "ru": ..., "en": ...}
    body_area: Mapped[str] = mapped_column(String(16))
    goals: Mapped[list[str]] = mapped_column(ARRAY(String(16)))
    gmfcs: Mapped[list[int]] = mapped_column(ARRAY(Integer))
    ages: Mapped[list[str]] = mapped_column(ARRAY(String(8)))
    tool: Mapped[str | None] = mapped_column(String(16))  # Home Kit tool, or none
    difficulty: Mapped[int]
    conflicts: Mapped[list[str]] = mapped_column(ARRAY(String(24)))  # restrictions that rule it out
    active: Mapped[bool] = mapped_column(default=True)  # false once it leaves exercises.json; kept for old plans


class VideoLang(StrEnum):
    """Videos are voiced in 3 languages (V3); Uzbek Cyrillic users get the Uzbek video."""

    uz = "uz"
    ru = "ru"
    en = "en"


class VideoStatus(StrEnum):
    waiting_review = "waiting_review"
    changes_requested = "changes_requested"
    rejected = "rejected"
    approved = "approved"


class Video(IdTimeMixin, Base):
    """The one video of an exercise in one language. A new file replaces the old one and waits for review again."""

    __tablename__ = "videos"
    __table_args__ = (UniqueConstraint("exercise_id", "lang"),)

    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id", ondelete="RESTRICT"))
    lang: Mapped[VideoLang] = mapped_column(enum_column(VideoLang))
    storage_key: Mapped[str] = mapped_column(String(256))  # the file in storage (A3.2)
    duration_s: Mapped[int | None]
    status: Mapped[VideoStatus] = mapped_column(
        enum_column(VideoStatus), default=VideoStatus.waiting_review, index=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReviewDecision(StrEnum):
    approved = "approved"
    rejected = "rejected"
    changes_requested = "changes_requested"


class VideoReview(IdTimeMixin, Base):
    """Every review decision with its note, kept for good: the history of a video."""

    __tablename__ = "video_reviews"

    video_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decision: Mapped[ReviewDecision] = mapped_column(enum_column(ReviewDecision))
    note: Mapped[str | None] = mapped_column(Text)
    storage_key: Mapped[str] = mapped_column(String(256))  # which file was reviewed


PLACEHOLDERS = "placeholders/"  # storage keys of the placeholder videos (C7): test servers only


def servable() -> ColumnElement[bool]:
    """A video a family may get: approved by a physiotherapist (product rule 3), and in production never a
    placeholder (C7)."""
    approved = Video.status == VideoStatus.approved
    return and_(approved, Video.storage_key.not_like(f"{PLACEHOLDERS}%")) if settings.env == "prod" else approved
