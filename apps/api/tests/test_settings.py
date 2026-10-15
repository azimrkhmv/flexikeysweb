from app.settings import Settings


def test_settings_come_from_the_environment() -> None:
    s = Settings()
    assert s.env == "test"
    assert s.redis_url == "redis://localhost:6380/1"
    assert s.s3_bucket == "flexikeys"
