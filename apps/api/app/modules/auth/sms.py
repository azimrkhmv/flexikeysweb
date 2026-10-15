"""Sending SMS. Only the simulated sender exists until an SMS provider is chosen (Q6, A13.2)."""

import logging
from typing import Protocol

from app.settings import settings

log = logging.getLogger("app.sms")


class SmsSender(Protocol):
    simulated: bool

    async def send(self, phone: str, text: str) -> None: ...


class FakeSms:
    """Sends nothing. The sign-in code is returned to the website as `demoCode` and written to the log."""

    simulated = True

    async def send(self, phone: str, text: str) -> None:
        log.info("simulated SMS to %s: %s", phone, text)


def get_sms() -> SmsSender:
    """FastAPI dependency."""
    match settings.sms_provider:
        case "fake":
            return FakeSms()
