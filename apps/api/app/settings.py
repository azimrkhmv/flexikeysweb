"""Server settings, read from environment variables or `apps/api/.env` (see `.env.example`)."""

from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str
    redis_url: str
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str = "flexikeys"
    jwt_secret: str  # signs access tokens; long and random outside dev
    sms_provider: Literal["fake"] = "fake"  # a real provider is added after Q6

    @model_validator(mode="after")
    def safe_in_production(self) -> Self:
        """The server refuses to start in production with settings that are only safe on a developer's computer."""
        if self.env == "prod" and self.sms_provider == "fake":
            raise ValueError("SMS is simulated: sign-in codes would be shown to anyone. Set a real SMS_PROVIDER.")
        return self


settings = Settings()
