"""The AI assistant (spec §12): chats about one child, their messages, and what every AI call cost.

A message's text can hold health details, so it is stored encrypted like the health answers (app/crypto.py).
"""

import uuid
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.modules.accounts.models import enum_column


class Chat(IdTimeMixin, Base):
    """One conversation of one adult (parent, helper or therapist) about one child."""

    __tablename__ = "chats"

    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class Speaker(StrEnum):
    adult = "adult"  # the person asking
    assistant = "assistant"


class ChatMessage(IdTimeMixin, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_chat_id_created_at", "chat_id", "created_at"),)

    chat_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"))
    speaker: Mapped[Speaker] = mapped_column(enum_column(Speaker))
    text_secret: Mapped[str] = mapped_column(Text)  # the text, encrypted (encrypt_json)
    lang: Mapped[str] = mapped_column(String(8))
    # Emergency words were found: the answer was the fixed 103 message, no AI call (A9.3).
    emergency: Mapped[bool] = mapped_column(Boolean, default=False)
    # Topics for the therapist's summary (A9.4): never the text itself.
    topics: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)))


class AiPurpose(StrEnum):
    chat = "chat"
    weekly_summary = "weekly_summary"
    plan_explanation = "plan_explanation"
    therapist_summary = "therapist_summary"
    plan = "plan"  # A4.6: the AI choosing a plan


class AiUsage(IdTimeMixin, Base):
    """One AI call: for the daily message limit (A9.2) and the monthly spending limit (A9.6)."""

    __tablename__ = "ai_usage"
    __table_args__ = (Index("ix_ai_usage_created_at", "created_at"),)  # the month's spending (A9.6)

    family_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    purpose: Mapped[AiPurpose] = mapped_column(enum_column(AiPurpose))
    model: Mapped[str] = mapped_column(String(80))
    input_tokens: Mapped[int]
    output_tokens: Mapped[int]
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6))
