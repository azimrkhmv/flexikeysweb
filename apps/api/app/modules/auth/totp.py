"""The second sign-in step for admins (A13.1): a 6-digit code from an authenticator app (TOTP, RFC 6238), so a
stolen SMS code alone cannot act as an admin. The secret is stored encrypted like the health answers."""

import base64
import hashlib
import hmac
import secrets
import struct
from urllib.parse import quote

STEP = 30  # seconds per code


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode()


def uri(secret: str, account: str) -> str:
    """For the authenticator app's QR code or "enter a setup key"."""
    return f"otpauth://totp/FlexiKeys:{quote(account)}?secret={secret}&issuer=FlexiKeys"


def code_at(secret: str, step: int) -> str:
    digest = hmac.new(base64.b32decode(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    return f"{(struct.unpack('>I', digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def matching_step(secret: str, code: str, now: float) -> int | None:
    """The time step this code belongs to (now, or one step either side for a slow clock), or None."""
    current = int(now // STEP)
    return next((s for s in (current, current - 1, current + 1) if hmac.compare_digest(code_at(secret, s), code)), None)
