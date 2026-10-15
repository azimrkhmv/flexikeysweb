# FlexiKeys

Home therapy app for children with cerebral palsy: a parent answers questions, gets a 4-week plan of exercises
and games, and does a short task each day.

## Where things live

- `TASKS.md` — the only plan file. All tasks, owners and order. Read section 1 before starting work.
- `docs/product-spec-2026-10-06.pdf` — the founders' spec. Wins over `PRD.md` and over `TASKS.md`, except the
  points in `TASKS.md` section 3.
- `apps/web/` — the website (Next.js 16, React 19, TypeScript). Owner: Azim. See `apps/web/AGENTS.md`.
- `apps/api/` — the server (Python 3.12, FastAPI, PostgreSQL, SQLAlchemy 2, Alembic, Redis, MinIO, Docker
  Compose). Owner: Bekzod.
- `apps/web/src/content/backend/` — `intake.json`, `exercises.json`, `roadmap_cases.json`: data the server must
  load and match. Kept in sync by `backend-content.test.ts`.

## How to work

1. Ask who you are working for (Azim or Bekzod) if it is not clear.
2. Take the first unticked task under that name in the earliest milestone of `TASKS.md` section 5. Check its
   **Needs** line is all ticked.
3. Branch from the newest `main`: `task/<number>-<two-or-three-words>`.
4. Do **only** that task. Other work you find becomes a new task in `TASKS.md`, not code.
5. Tick the task's box in `TASKS.md` in the same branch.
6. Open a pull request to `main` titled `<number>: <short name>`. Say how you checked the **Done when** line.
7. Stuck: add `  - BLOCKED: <why>` under the task, push, and tell the developer.

## Rules for working together

- Only Bekzod adds database tables and migrations. Never edit a merged migration; add a new one.
- Azim owns `apps/web/`, Bekzod owns `apps/api/`. Changes in the other person's area go through their review.
- Agree on a new server address (input and output) before building both sides. Write it in the first PR.
- Keys and passwords never go into git or chat. This repository is public.
- Commit messages start with `feat:`, `fix:`, `docs:`, `chore:` or `test:`.
- Bekzod is on Claude Pro: one task per session, small steps, commit and push after each working step.

## Rules of the product (never break these)

1. No diagnosis and no scores for parents. No percentages, no comparing children.
2. Safety beats convenience. Anything a doctor or therapist forbids never appears in a plan, a daily task or an
   assistant answer.
3. A physiotherapist approves every video before any family sees it.
4. A therapist's answer wins over a parent's answer.
5. A missed tap is not a wrong answer. It is saved as an "access event" and left out of the skill level.
6. One family can never see another family's child.
7. The child's screens never show failure: no timer, no red, no X, no failure sound.
