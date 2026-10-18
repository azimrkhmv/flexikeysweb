"""Movement and feedback clips the parent films (spec §5 P40, §8): only a therapist the child is shared with can
watch them, AI never analyses them, and they stay until the parent deletes them."""

import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.modules.accounts.models import enum_column


class ClipKind(StrEnum):
    movement = "movement"  # P40: walking or crawling, picking up a toy, drawing or tapping
    feedback = "feedback"  # the child doing one exercise of the plan


class Clip(IdTimeMixin, Base):
    __tablename__ = "clips"

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    kind: Mapped[ClipKind] = mapped_column(enum_column(ClipKind))
    exercise_id: Mapped[str | None] = mapped_column(String(48))  # a feedback clip: which exercise
    storage_key: Mapped[str] = mapped_column(String(256))
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class ClipReply(IdTimeMixin, Base):
    """A therapist's reply to a clip (T9: notes per clip)."""

    __tablename__ = "clip_replies"

    clip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clips.id", ondelete="CASCADE"), index=True)
    therapist_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    text: Mapped[str] = mapped_column(Text)
