"""The parent's assistant chat (A9.2, spec §12). A family member asks about one child; the AI gets the question,
the recent chat and the child's age in years, never the child's name or birth date. Free families have about 20
messages a day, Pro has no limit."""

import re
import uuid
from collections import Counter
from datetime import UTC, datetime, time
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_json, encrypt_json
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Lang
from app.modules.assistant.ai import Ai, get_ai, over_budget
from app.modules.assistant.models import AiPurpose, AiUsage, Chat, ChatMessage, Speaker
from app.modules.assistant.safety import (
    EMERGENCY_ANSWER,
    RESTING_ANSWER,
    SAFE_ANSWER,
    avoid_words,
    breaks_restriction,
    is_emergency,
    topics_of,
)  # fmt: skip
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.billing.router import plan_of
from app.modules.children.models import Child
from app.modules.children.router import get_visible_child, require_owner
from app.modules.plans.router import TASHKENT
from app.modules.therapists.form import child_restrictions
from app.modules.therapists.router import get_shared_child
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(tags=["assistant"])
therapist_router = APIRouter(prefix="/therapist", tags=["assistant"])
RESTRICTED = "restricted"  # the topic of an answer replaced because it touched a restriction (a warning)
HISTORY = 10  # earlier messages the AI sees
LANG_NAME = {
    Lang.uz: "Uzbek (Latin script)",
    Lang.uz_cyrl: "Uzbek (Cyrillic script)",
    Lang.ru: "Russian",
    Lang.en: "English",
}
SYSTEM = (
    "You help a parent in Uzbekistan do home therapy with their child, who has cerebral palsy. The child is {age} "
    "years old. Answer in {lang}, in short plain sentences. You are not a doctor: never diagnose, never talk about "
    "medicine doses, never contradict a doctor's or therapist's advice. For a medical question give general "
    "information, then advise seeing a doctor. Call the child 'the child'. The child's doctor or therapist said to "
    "avoid: {avoid}. Never suggest these, not even as an option."
)


class Question(ApiModel):
    text: str = Field(min_length=1, max_length=1000)
    lang: Lang


class Answer(ApiModel):
    answer: str
    emergency: bool  # emergency words: the answer is the fixed 103 message, no AI was asked
    remaining_today: int | None  # messages left today on Free; empty on Pro


def without_child(text: str, child: Child) -> str:
    """The child's name (any case) and birth date are replaced before anything is sent to the AI."""
    text = re.sub(rf"\b{re.escape(child.name)}\b", "the child", text, flags=re.IGNORECASE)
    for form in (child.birth_date.isoformat(), child.birth_date.strftime("%d.%m.%Y")):
        text = text.replace(form, "[date]")
    return text


@router.post("/children/{child_id}/assistant/messages")
async def ask(
    child_id: uuid.UUID,
    body: Question,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    ai: Annotated[Ai, Depends(get_ai)],
) -> Answer:
    """Emergency words (A9.3) get the fixed 103 answer first, before any limit or AI. 429 daily_limit when a Free family
    used today's messages; 503 ai_unavailable when the AI does not answer. An answer that mentions a movement the
    child must avoid is replaced by a fixed safe answer."""
    child = await get_visible_child(db, user, child_id)
    chat = await db.scalar(
        select(Chat).where(Chat.child_id == child.id, Chat.user_id == user.id).order_by(Chat.created_at.desc())
    )
    if chat is None:
        chat = Chat(child_id=child.id, user_id=user.id)
        db.add(chat)
        await db.flush()

    def store(speaker: Speaker, text: str, emergency: bool = False, topics: list[str] | None = None) -> None:
        db.add(
            ChatMessage(
                chat_id=chat.id, speaker=speaker, text_secret=encrypt_json(text), lang=body.lang, topics=topics,
                emergency=emergency, created_at=datetime.now(UTC),  # not now(): both messages share one transaction
            )
        )  # fmt: skip

    if is_emergency(body.text):
        store(Speaker.adult, body.text, emergency=True, topics=topics_of(body.text))
        store(Speaker.assistant, EMERGENCY_ANSWER[body.lang], emergency=True)
        await db.commit()
        return Answer(answer=EMERGENCY_ANSWER[body.lang], emergency=True, remaining_today=None)

    limit = None if (await plan_of(db, child.family_id)).plan == "pro" else settings.free_ai_messages_per_day
    midnight = datetime.combine(datetime.now(TASHKENT).date(), time(), TASHKENT).astimezone(UTC)
    used = await db.scalar(
        select(func.count()).where(
            AiUsage.family_id == child.family_id, AiUsage.purpose == AiPurpose.chat, AiUsage.created_at >= midnight
        )
    )
    if limit is not None and (used or 0) >= limit:
        raise AppError(429, "daily_limit")

    if await over_budget(db):  # A9.6: fixed words until next month, not counted against the day
        store(Speaker.adult, body.text, topics=topics_of(body.text))
        store(Speaker.assistant, RESTING_ANSWER[body.lang])
        await db.commit()
        left = None if limit is None else limit - (used or 0)
        return Answer(answer=RESTING_ANSWER[body.lang], emergency=False, remaining_today=left)

    earlier = list(
        await db.scalars(
            select(ChatMessage)
            .where(ChatMessage.chat_id == chat.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY)
        )
    )[::-1]
    today = datetime.now(TASHKENT).date()
    age = (
        today.year - child.birth_date.year - ((today.month, today.day) < (child.birth_date.month, child.birth_date.day))
    )
    restrictions = await child_restrictions(db, child)
    system = SYSTEM.format(age=age, lang=LANG_NAME[body.lang], avoid=avoid_words(restrictions) or "nothing")
    messages = [{"role": "system", "content": system}]
    for m in earlier:
        role = "user" if m.speaker == Speaker.adult else "assistant"
        messages.append({"role": role, "content": without_child(decrypt_json(m.text_secret), child)})
    messages.append({"role": "user", "content": without_child(body.text, child)})

    store(Speaker.adult, body.text, topics=topics_of(body.text))
    reply = await ai.chat(messages)
    blocked = breaks_restriction(reply.text, restrictions) is not None
    answer = SAFE_ANSWER[body.lang] if blocked else reply.text
    store(Speaker.assistant, answer, topics=[RESTRICTED] if blocked else None)
    db.add(
        AiUsage(
            family_id=child.family_id, user_id=user.id, purpose=AiPurpose.chat, model=reply.model,
            input_tokens=reply.input_tokens, output_tokens=reply.output_tokens, cost_usd=reply.cost_usd,
        )
    )  # fmt: skip
    await db.commit()
    return Answer(
        answer=answer, emergency=False, remaining_today=None if limit is None else max(limit - (used or 0) - 1, 0)
    )


# ---------------------------------------------------------------- A9.4: the chat, deleting it, the therapist's summary


class MessageOut(ApiModel):
    id: uuid.UUID
    speaker: Speaker
    text: str
    emergency: bool
    created_at: datetime


@router.get("/children/{child_id}/assistant/messages")
async def my_chat(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[MessageOut]:
    """This person's chat about the child, oldest first. Kept until they (or the family's owner) delete it."""
    await get_visible_child(db, user, child_id)
    rows = await db.scalars(
        select(ChatMessage)
        .join(Chat, Chat.id == ChatMessage.chat_id)
        .where(Chat.child_id == child_id, Chat.user_id == user.id)
        .order_by(ChatMessage.created_at)
    )
    return [
        MessageOut(id=m.id, speaker=m.speaker, text=decrypt_json(m.text_secret), emergency=m.emergency,
                   created_at=m.created_at)
        for m in rows
    ]  # fmt: skip


async def _delete_chats(db: AsyncSession, child_id: uuid.UUID, user_id: uuid.UUID) -> None:
    await db.execute(delete(Chat).where(Chat.child_id == child_id, Chat.user_id == user_id))  # messages cascade


@router.delete("/children/{child_id}/assistant/messages", status_code=204)
async def delete_my_chat(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    """Deleted at once, for good."""
    await get_visible_child(db, user, child_id)
    await _delete_chats(db, child_id, user.id)
    audit.record(db, user.id, "chat.deleted", child_id)
    await db.commit()
    return Response(status_code=204)


@router.delete("/children/{child_id}/chats/{user_id}", status_code=204)
async def delete_chat(
    child_id: uuid.UUID, user_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    """The family's owner deletes any adult's chat about the child ("Everything we store")."""
    child = await get_visible_child(db, user, child_id)
    await require_owner(db, user, child.family_id)
    await _delete_chats(db, child_id, user_id)
    audit.record(db, user.id, "chat.deleted", child_id, of=str(user_id))
    await db.commit()
    return Response(status_code=204)


class TopicCount(ApiModel):
    topic: str
    count: int


class ChatWarning(ApiModel):
    kind: Literal["emergency", "restricted"]
    at: datetime


class ChatSummary(ApiModel):
    questions: int
    topics: list[TopicCount]  # most asked first
    warnings: list[ChatWarning]  # newest first


@therapist_router.get("/children/{child_id}/assistant-summary")
async def summary(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> ChatSummary:
    """What the family asked the assistant about this child: topics and warnings only, never the chat (spec §12)."""
    await get_shared_child(db, user, child_id)
    rows = (
        await db.execute(
            select(ChatMessage.speaker, ChatMessage.topics, ChatMessage.emergency, ChatMessage.created_at)
            .join(Chat, Chat.id == ChatMessage.chat_id)
            .where(Chat.child_id == child_id)
        )
    ).all()
    asked = [r for r in rows if r.speaker == Speaker.adult]
    counts = Counter(t for r in asked for t in r.topics or ["other"])
    warnings = [ChatWarning(kind="emergency", at=r.created_at) for r in asked if r.emergency] + [
        ChatWarning(kind="restricted", at=r.created_at) for r in rows if RESTRICTED in (r.topics or [])
    ]
    audit.record(db, user.id, "therapist.assistant_summary_viewed", child_id)
    await db.commit()
    return ChatSummary(
        questions=len(asked),
        topics=[TopicCount(topic=t, count=n) for t, n in counts.most_common()],
        warnings=sorted(warnings, key=lambda w: w.at, reverse=True),
    )
