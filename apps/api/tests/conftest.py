import os

# The tests must not depend on a developer's .env file, so they set their own values first.
os.environ.update(
    ENV="test",
    DATABASE_URL="postgresql+asyncpg://flexikeys:flexikeys@localhost:5433/flexikeys_test",
    REDIS_URL="redis://localhost:6380/1",
    S3_ENDPOINT="http://localhost:9100",
    S3_ACCESS_KEY="test",
    S3_SECRET_KEY="test",
)
