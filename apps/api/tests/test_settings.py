import os
import subprocess
import sys

import pytest
from pydantic import ValidationError

from app.settings import Settings


def test_settings_come_from_the_environment() -> None:
    s = Settings()
    assert s.env == "test"
    assert s.redis_url == "redis://localhost:6380/1"
    assert s.s3_bucket == "flexikeys-test"


def test_simulated_sms_is_fine_outside_production() -> None:
    assert Settings(env="dev", sms_provider="fake").sms_provider == "fake"


def test_production_refuses_to_start_with_simulated_sms() -> None:
    with pytest.raises(ValidationError, match="SMS is simulated"):
        Settings(env="prod", sms_provider="fake")


def test_the_server_itself_does_not_start() -> None:
    """The real start path: loading the app with ENV=prod and simulated SMS fails."""
    env = os.environ | {"ENV": "prod", "SMS_PROVIDER": "fake"}
    r = subprocess.run([sys.executable, "-c", "import app.main"], env=env, capture_output=True, text=True)
    assert r.returncode != 0
    assert "SMS is simulated" in r.stderr
