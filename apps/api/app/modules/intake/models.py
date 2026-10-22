import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin


class IntakeRound(IdTimeMixin, Base):
    """One pass through the parent questions. Round 1 at the start, then one every 3 months (A2.7)."""

    __tablename__ = "intake_rounds"
    __table_args__ = (UniqueConstraint("child_id", "number"),)

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    number: Mapped[int]
    # Which question set: "p41" (spec §5, P1-P41) or the CEO's questionnaire by its date (IQ2). Never changes.
    questionnaire: Mapped[str] = mapped_column(String(16), server_default="p41")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IntakeAnswer(IdTimeMixin, Base):
    """One answer. `value` is the JSON answer; SQL NULL means "Not sure" (spec §5).

    Health questions keep `value` empty and store the answer encrypted in `secret` instead (A2.5, app/crypto.py);
    "Not sure" on a health question leaves both empty."""

    __tablename__ = "intake_answers"
    __table_args__ = (UniqueConstraint("round_id", "question_id"),)

    round_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("intake_rounds.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str] = mapped_column(String(16))
    value: Mapped[Any] = mapped_column(JSONB(none_as_null=True), nullable=True)
    secret: Mapped[str | None] = mapped_column(Text)
    answered_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
