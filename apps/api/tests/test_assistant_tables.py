"""A9.1: chats, messages and AI usage. A message's text is encrypted; deleting the child deletes its chats, while the
record of what AI cost stays (no text in it)."""

import uuid
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.crypto import decrypt_json, encrypt_json
from app.main import app
from app.modules.assistant.models import AiPurpose, AiUsage, Chat, ChatMessage, Speaker
from app.modules.children.models import Child
from tests.test_children import API, add_child, parent
from tests.test_videos_register import run


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_a_chat_its_messages_and_the_cost(client: TestClient) -> None:
    owner = parent(client)
    child = uuid.UUID(add_child(client, owner))
    me = uuid.UUID(client.get(f"{API}/me", headers=owner).json()["id"])

    async def write(db: Any) -> uuid.UUID:
        kid = await db.get(Child, child)
        chat = Chat(child_id=child, user_id=me)
        db.add(chat)
        await db.flush()
        db.add(ChatMessage(chat_id=chat.id, speaker=Speaker.adult, text_secret=encrypt_json("Can he jump?"), lang="en"))
        cost = Decimal("0.000420")
        db.add(
            AiUsage(
                family_id=kid.family_id,
                user_id=me,
                purpose=AiPurpose.chat,
                model="x",
                input_tokens=10,
                output_tokens=5,
                cost_usd=cost,
            )
        )
        await db.commit()
        return chat.id

    chat_id = run(client, write)

    async def read(db: Any) -> tuple[str, int]:
        m = await db.scalar(select(ChatMessage).where(ChatMessage.chat_id == chat_id))
        return decrypt_json(m.text_secret), await db.scalar(
            select(func.count()).select_from(AiUsage).where(AiUsage.user_id == me)
        )

    assert run(client, read) == ("Can he jump?", 1)

    assert client.delete(f"{API}/children/{child}", headers=owner).status_code == 204

    async def after(db: Any) -> tuple[int, int, int]:
        chats = await db.scalar(select(func.count()).select_from(Chat).where(Chat.child_id == child))
        messages = await db.scalar(select(func.count()).select_from(ChatMessage).where(ChatMessage.chat_id == chat_id))
        usage = await db.scalar(select(func.count()).select_from(AiUsage).where(AiUsage.user_id == me))
        return chats, messages, usage

    assert run(client, after) == (0, 0, 1)
