"""The parent's assistant chat (A9.2, spec §12). A family member asks about one child; the AI gets the question,
the recent chat and the child's age in years, never the child's name or birth date. Free families have about 20
messages a day, Pro has no limit."""

import re
import uuid
from datetime import UTC, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_json, encrypt_json
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import Lang
from app.modules.assistant.ai import Ai, get_ai
from app.modules.assistant.models import AiPurpose, AiUsage, Chat, ChatMessage, Speaker
from app.modules.assistant.safety import EMERGENCY_ANSWER, SAFE_ANSWER, avoid_words, breaks_restriction, is_emergency
from app.modules.auth.session import CurrentUser
from app.modules.billing.router import plan_of
from app.modules.children.models import Child
from app.modules.children.router import get_visible_child
from app.modules.plans.router import TASHKENT
from app.modules.therapists.form import child_restrictions
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(tags=["assistant"])
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

    def store(speaker: Speaker, text: str, emergency: bool = False) -> None:
        db.add(
            ChatMessage(
                chat_id=chat.id, speaker=speaker, text_secret=encrypt_json(text), lang=body.lang,
                emergency=emergency, created_at=datetime.now(UTC),  # not now(): both messages share one transaction
            )
        )  # fmt: skip

    if is_emergency(body.text):
        store(Speaker.adult, body.text, emergency=True)
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

    store(Speaker.adult, body.text)
    reply = await ai.chat(messages)
    answer = SAFE_ANSWER[body.lang] if breaks_restriction(reply.text, restrictions) else reply.text
    store(Speaker.assistant, answer)
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
