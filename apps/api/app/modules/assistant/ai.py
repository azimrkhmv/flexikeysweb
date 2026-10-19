"""The AI behind the assistant (A9.2): one setting picks OpenRouter (any model through one key) or a pretend AI
that answers with a fixed sentence, for tests and for computers without the key. AI never builds the plan; it only
answers from what it is given (spec §13)."""

import asyncio
import json
import logging
import urllib.request
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Protocol

from app.errors import AppError
from app.settings import settings

log = logging.getLogger("app.ai")
OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"


@dataclass
class AiReply:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal


class Ai(Protocol):
    async def chat(self, messages: list[dict[str, str]]) -> AiReply: ...


@dataclass
class FakeAi:
    """Answers with a fixed sentence and keeps what it was sent, so a test can read every request."""

    sent: list[list[dict[str, str]]] = field(default_factory=list)
    answer: str = "This is a pretend answer. The real assistant is not connected here."

    async def chat(self, messages: list[dict[str, str]]) -> AiReply:
        self.sent.append(messages)
        return AiReply(self.answer, "fake", 0, 0, Decimal(0))


class OpenRouterAi:
    async def chat(self, messages: list[dict[str, str]]) -> AiReply:
        body = {"model": settings.ai_model, "messages": messages, "max_tokens": 600, "usage": {"include": True}}
        request = urllib.request.Request(
            OPENROUTER,
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}", "Content-Type": "application/json"},
        )
        try:
            # ponytail: the standard library in a thread; an async HTTP client when many people chat at once.
            raw = await asyncio.to_thread(lambda: urllib.request.urlopen(request, timeout=60).read())  # noqa: S310
            data = json.loads(raw)
            usage = data.get("usage") or {}
            return AiReply(
                text=data["choices"][0]["message"]["content"].strip(),
                model=data.get("model", settings.ai_model),
                input_tokens=int(usage.get("prompt_tokens", 0)),
                output_tokens=int(usage.get("completion_tokens", 0)),
                cost_usd=Decimal(str(usage.get("cost", 0))),
            )
        except Exception as e:  # the network, the provider or an odd answer: the parent can try again
            log.warning("AI call failed: %s", type(e).__name__)
            raise AppError(503, "ai_unavailable") from None


def get_ai() -> Ai:
    """FastAPI dependency."""
    return OpenRouterAi() if settings.ai_provider == "openrouter" else FakeAi()
