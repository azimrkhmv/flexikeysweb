"""Server settings, read from environment variables or `apps/api/.env` (see `.env.example`)."""

from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_HEALTH_KEY = "rns5GjXuzrOlYZEsm_Rpxq6AYW-NsEDRLg9XzFxbZSQ="  # the key in .env.example: public, dev only


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str
    redis_url: str
    s3_endpoint: str
    s3_public_endpoint: str | None = None  # what browsers use; app/storage.py. Empty = same as s3_endpoint
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str = "flexikeys"
    jwt_secret: str  # signs access tokens; long and random outside dev
    sms_provider: Literal["fake"] = "fake"  # a real provider is added after Q6
    site_url: str = "http://localhost:3000"  # the website, for links in SMS (deploy: https://<domain>)
    # Encrypts health answers (app/crypto.py). Comma-separated; the first one encrypts. Never in git outside dev.
    health_keys: str
    max_children_per_family: int = 3
    max_helpers_per_family: int = 1
    # Sign-in codes per IP address per hour (app/modules/auth/otp.py). The live browser tests sign in many times
    # from one address, so their test server raises it (.github/workflows/e2e-live.yml).
    otp_per_ip_per_hour: int = 20
    intake_repeat_days: int = (
        90  # the questions come back every 3 months (spec)  # TASKS.md section 3: "Both numbers are settings"
    )

    @model_validator(mode="after")
    def safe_in_production(self) -> Self:
        """The server refuses to start in production with settings that are only safe on a developer's computer."""
        if self.env != "prod":
            return self
        if self.sms_provider == "fake":
            raise ValueError("SMS is simulated: sign-in codes would be shown to anyone. Set a real SMS_PROVIDER.")
        if DEV_HEALTH_KEY in self.health_keys:  # reachable once a real SMS provider exists (after Q6)
            raise ValueError("HEALTH_KEYS holds the public dev key from .env.example; see docs/health-key.md")
        return self


settings = Settings()
