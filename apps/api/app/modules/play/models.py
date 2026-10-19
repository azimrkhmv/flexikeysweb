"""Child play (spec §7, §13): how the child touches the screen, the play check, skill levels, game sessions, and the
record of every try.

Tries are kept 90 days (TASKS.md section 3). The tries table is split by month (PostgreSQL partitions, one table per
month, app/modules/play/tries.py), so a whole old month is removed in one step instead of row by row.
"""

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    Uuid,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app import storage
from app.db import Base, IdTimeMixin, TimeMixin
from app.modules.accounts.models import enum_column


class InputMode(StrEnum):
    touch = "touch"
    dwell = "dwell"  # hold to choose
    switch = "switch"  # switch scanning
    keyboard = "keyboard"


class AccessProfile(TimeMixin, Base):
    """The child's five access settings, found by the play check's first stage; every game reads them."""

    __tablename__ = "access_profiles"
    __table_args__ = (
        CheckConstraint("min_target_mm >= 12", name="min_target_mm"),
        CheckConstraint("dwell_ms between 500 and 3000", name="dwell_ms"),
    )

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)
    input_mode: Mapped[InputMode] = mapped_column(enum_column(InputMode))
    min_target_mm: Mapped[int] = mapped_column(SmallInteger)  # the smallest button that works, never below 12
    dwell_ms: Mapped[int] = mapped_column(SmallInteger)  # how long a hold chooses, 500-3000
    repeat_lock: Mapped[bool]  # ignore a second touch within 300 ms
    release_ok: Mapped[bool]  # the child lifts the finger cleanly after holding


class RunStatus(StrEnum):
    open = "open"
    finished = "finished"
    stopped = "stopped"  # upset or tired: a retry is offered within 3 days


class PlayCheckRun(IdTimeMixin, Base):
    """One play check: stage 1 (hands and touch), then stage 2 (four placement games)."""

    __tablename__ = "play_check_runs"

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    status: Mapped[RunStatus] = mapped_column(enum_column(RunStatus), default=RunStatus.open)
    stage: Mapped[int] = mapped_column(SmallInteger, default=1)
    helped_by_adult: Mapped[bool] = mapped_column(default=False)  # the parent helped; recorded, never held against
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SkillArea(StrEnum):
    access = "access"
    attention = "attention"
    memory = "memory"
    flexibility = "flexibility"
    literacy = "literacy"
    numeracy = "numeracy"


class SkillLevel(TimeMixin, Base):
    """θ (theta) of one skill area: a first guess from the questions, corrected by the play check, then moved by
    every clean try (spec §13). Never shown to parents as a score (rule 1)."""

    __tablename__ = "skill_levels"
    __table_args__ = (PrimaryKeyConstraint("child_id", "area"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    area: Mapped[SkillArea] = mapped_column(enum_column(SkillArea))
    theta: Mapped[float] = mapped_column(Float)
    n_trials: Mapped[int] = mapped_column(Integer, default=0)  # clean tries counted so far (K shrinks with them)


class GameSession(IdTimeMixin, Base):
    """One sitting of play. Its seconds count towards the 20-minute daily limit."""

    __tablename__ = "game_sessions"
    __table_args__ = (Index("ix_game_sessions_child_id_day", "child_id", "day"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date)  # Tashkent date
    seconds_played: Mapped[int] = mapped_column(Integer, default=0)
    play_check_run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("play_check_runs.id", ondelete="SET NULL"))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Outcome(StrEnum):
    correct = "correct"
    wrong = "wrong"
    skipped = "skipped"


class Hint(StrEnum):
    none = "none"
    shimmer = "shimmer"  # after 2 mistakes the right answer shimmers
    fade = "fade"  # after 4 the others fade


class Try(Base):
    """One try in a game, as the spec records it (§7). `access_event`: a missed tap, a double tap or a hold released
    too early. It is not a wrong answer and never moves a skill level (rule 5). `response_ms` is never scored.

    Split by month on `ts`; the same try sent twice has the same id and ts, so it is stored once."""

    __tablename__ = "tries"
    __table_args__ = (
        PrimaryKeyConstraint("id", "ts"),
        Index("ix_tries_child_id_ts", "child_id", "ts"),
        {"postgresql_partition_by": "RANGE (ts)"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid)  # made by the device, so a batch sent twice is stored once
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # when the try happened, on the device
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("game_sessions.id", ondelete="SET NULL"))
    game: Mapped[str] = mapped_column(String(32))
    level: Mapped[int] = mapped_column(SmallInteger)
    item_id: Mapped[str] = mapped_column(String(64))
    input_mode: Mapped[InputMode] = mapped_column(enum_column(InputMode))
    outcome: Mapped[Outcome] = mapped_column(enum_column(Outcome))
    attempts: Mapped[int] = mapped_column(SmallInteger)
    hint_shown: Mapped[Hint] = mapped_column(enum_column(Hint))
    access_event: Mapped[bool]
    helped_by_adult: Mapped[bool]
    response_ms: Mapped[int | None] = mapped_column(Integer)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VoiceCard(IdTimeMixin, Base):
    """A My Voice card the parent made: a label, an emoji or the parent's own photo, and their recorded voice. Kept on
    the server so the cards are the same on every device of the family (Q2). The files are in storage (A3.2)."""

    __tablename__ = "voice_cards"

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(24))
    label: Mapped[str] = mapped_column(String(60))
    emoji: Mapped[str] = mapped_column(String(16))
    photo_key: Mapped[str | None] = mapped_column(String(256))
    audio_key: Mapped[str | None] = mapped_column(String(256))
    made_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


async def forget_voices(db: AsyncSession, child_id: uuid.UUID) -> None:
    """The voice_recording consent was taken back (G8): every recorded voice of the child's cards is deleted. The
    cards stay, with their label, emoji and photo. The caller commits."""
    for card in await db.scalars(
        select(VoiceCard).where(VoiceCard.child_id == child_id, VoiceCard.audio_key.is_not(None))
    ):
        storage.remove(card.audio_key)  # type: ignore[arg-type]
        card.audio_key = None


class GamePlayed(TimeMixin, Base):
    """When the child first played each kind of game, and the highest level tried. Kept for good (tries go after 90
    days), so a game played once is never "new" again and an open game is never taken away (spec §13)."""

    __tablename__ = "games_played"
    __table_args__ = (PrimaryKeyConstraint("child_id", "game"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"))
    game: Mapped[str] = mapped_column(String(32))
    first_played: Mapped[date] = mapped_column(Date)
    top_level: Mapped[int] = mapped_column(SmallInteger)  # the highest world level tried: the next one is open too
