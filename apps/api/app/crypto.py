"""Encryption for health data (A2.5). Without the key, a copy of the database shows only scrambled text.

HEALTH_KEYS is a comma-separated list of Fernet keys (AES with a tamper check). The first key encrypts; every key
can decrypt, so a new key can be put first and old data still reads. Where the key lives and how it is backed up:
docs/health-key.md (A2.6).
"""

import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.settings import settings

_fernet = MultiFernet([Fernet(k.strip()) for k in settings.health_keys.split(",") if k.strip()])


def encrypt_json(value: Any) -> str:
    return _fernet.encrypt(json.dumps(value, ensure_ascii=False).encode()).decode()


def decrypt_json(token: str) -> Any:
    try:
        return json.loads(_fernet.decrypt(token.encode()))
    except InvalidToken:
        raise RuntimeError("health data cannot be decrypted: wrong or missing HEALTH_KEYS") from None
