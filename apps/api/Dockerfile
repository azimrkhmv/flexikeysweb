# FlexiKeys server image. Two stages: the first installs the packages with uv, the second only copies them, so
# uv and the build cache are not in the image. The server runs as a user without root rights.
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim AS run
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=build /app/.venv ./.venv
COPY app ./app
COPY alembic.ini ./
COPY migrations ./migrations
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
