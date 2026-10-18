# FlexiKeys

Home therapy app for children with cerebral palsy: a parent answers questions, gets a 4-week plan of exercises
and games, and does a short task each day.

## Where things live

- `TASKS.md` — the only plan file. All tasks, owners and order. Read section 1 before starting work.
- `docs/product-spec-2026-10-06.pdf` — the founders' spec. Wins over `PRD.md` and over `TASKS.md`, except the
  points in `TASKS.md` section 3.
- `apps/web/` — the website (Next.js 16, React 19, TypeScript). See `apps/web/AGENTS.md`.
- `apps/api/` — the server (Python 3.12, FastAPI, PostgreSQL, SQLAlchemy 2, Alembic, Redis, MinIO, Docker
  Compose).
  Commands, run in `apps/api/`: `cp .env.example .env` (once), `docker compose up -d` (server, PostgreSQL,
  Redis, MinIO), `uv run uvicorn app.main:app --reload` (server only, on your computer), `uv run pytest` (needs
  `docker compose up -d db redis minio`; builds a fresh `flexikeys_test` database), `uv run alembic upgrade head`,
  `uv run ruff check .`, `uv run ruff format .`, `uv run mypy app tests migrations`. New feature = new folder in
  `app/modules/` with a `router.py`, included in `app/main.py`.
  Addresses live under `/api/v1` (the website proxies it). A signed-in address takes `user: session.CurrentUser`
  (`app/modules/auth/session.py`: cookie + CSRF for the website, Bearer token for the app).
  Exercise library (after each change to `app/content/exercises.json`): `uv run python -m app.cli load-exercises`.
  Anything about a child: `await require_child_access(db, user, child.family_id)` (`app/modules/accounts/access.py`),
  404 for everyone else. Admin only: `_: Admin`. First admin: `uv run python -m app.cli create-admin +998…`.
  Errors: `raise AppError(409, "phone_taken")` (`app/errors.py`) — the website reads the code from `title`.
  Changed an address: `UPDATE_OPENAPI=1 uv run pytest tests/test_openapi.py` rewrites `apps/api/openapi.json`;
  `npm run typecheck` in `apps/web/` rebuilds the website's types from it (`src/lib/server/`).
- `apps/web/src/content/backend/` — `intake.json`, `exercises.json`, `roadmap_cases.json`: data the server must
  load and match. Kept in sync by `backend-content.test.ts`.

## How to work

Solo phase: Azim does every open task alone, until he hands the project to Bekzod (`TASKS.md` section 4).

1. Take the first unticked task in the earliest milestone of `TASKS.md` section 5 (server list first, then
   website list). Check its **Needs** line is all ticked.
2. Work on `main`. Pull first.
3. Do **only** that task. Other work you find becomes a new task in `TASKS.md`, not code.
4. Tick the task's box in `TASKS.md` in the same commit.
5. Check the **Done when** line and run the tests. Fix anything red before pushing.
6. Commit and push to `main`. The message names the task, for example `feat: A0.1 project skeleton`.
7. Stuck: add `  - BLOCKED: <why>` under the task and push.

## Rules

- Never edit a database migration that is already pushed; add a new one.
- Write the shape of each new server address (input and output) in its commit message.
- Keys and passwords never go into git or chat. This repository is public.
- Commit messages start with `feat:`, `fix:`, `docs:`, `chore:` or `test:`.
- Work in a `/loop`: one task at a time, a short plain-language report after each. Skip tasks waiting for Azim.

## Rules of the product (never break these)

1. No diagnosis and no scores for parents. No percentages, no comparing children.
2. Safety beats convenience. Anything a doctor or therapist forbids never appears in a plan, a daily task or an
   assistant answer.
3. A physiotherapist approves every video before any family sees it.
4. A therapist's answer wins over a parent's answer.
5. A missed tap is not a wrong answer. It is saved as an "access event" and left out of the skill level.
6. One family can never see another family's child.
7. The child's screens never show failure: no timer, no red, no X, no failure sound.
