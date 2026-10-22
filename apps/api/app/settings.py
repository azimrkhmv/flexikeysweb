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
    # What Free includes (A7.2, spec §14; the founders' PROPOSAL, placeholders until G3). Pro has no limits.
    free_plan_days: int = 7  # the first week of the plan
    free_offline_videos: bool = False
    free_therapist_sharing: bool = False  # sharing with a therapist and feedback clips
    # Sign-in codes per IP address per hour (app/modules/auth/otp.py). The live browser tests sign in many times
    # from one address, so their test server raises it (.github/workflows/e2e-live.yml).
    otp_per_ip_per_hour: int = 20
    # The assistant (A9.2): OpenRouter when its key is set (never in tests), else a pretend AI with fixed answers.
    openrouter_api_key: str = ""
    ai_model: str = "google/gemini-2.5-flash"  # placeholder until the blind test (E2) picks the model
    free_ai_messages_per_day: int = 20  # per family on Free (spec §12: "about 20"); Pro has no limit
    ai_monthly_limit_usd: float = 50.0  # A9.6: past this the assistant gives fixed answers until next month
    # A9.8: the knowledge base the assistant answers from (a Markdown file or a folder of them), kept outside the
    # repository. Empty: no library (tests, computers without the file); production refuses a real AI without it.
    research_path: str = ""
    intake_repeat_days: int = (
        90  # the questions come back every 3 months (spec)  # TASKS.md section 3: "Both numbers are settings"
    )
    # The question set new rounds use: "p41" (spec §5) until the switch to the CEO's questionnaire (IQ8).
    intake_questionnaire: Literal["p41", "2026-10-16"] = "p41"

    @property
    def ai_provider(self) -> Literal["fake", "openrouter"]:
        return "openrouter" if self.openrouter_api_key and self.env != "test" else "fake"

    @model_validator(mode="after")
    def safe_in_production(self) -> Self:
        """The server refuses to start in production with settings that are only safe on a developer's computer."""
        if self.env != "prod":
            return self
        if self.sms_provider == "fake":
            raise ValueError("SMS is simulated: sign-in codes would be shown to anyone. Set a real SMS_PROVIDER.")
        if self.openrouter_api_key and not self.research_path:
            raise ValueError("The assistant would answer from the AI's own knowledge. Set RESEARCH_PATH (A9.8).")
        if DEV_HEALTH_KEY in self.health_keys:  # reachable once a real SMS provider exists (after Q6)
            raise ValueError("HEALTH_KEYS holds the public dev key from .env.example; see docs/health-key.md")
        return self


settings = Settings()
