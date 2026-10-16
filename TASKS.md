# FlexiKeys — Tasks

This is the **only plan file** of the project. Everything left to build is here, as small tasks, each with the
name of the developer who does it.

> **Solo phase (since 2026-10-15):** Azim builds alone — the base and the hardest parts — and then hands the
> project to Bekzod (see "Handover" in section 4). Every open task is Azim's until then. No reviews.

- **What we are building** is described in the founders' spec: `docs/product-spec-2026-10-06.pdf`. Where this file
  and the spec disagree, the spec wins — except for the three points listed in section 3.
- `PRD.md` is the older product document. The spec replaced the parts where they disagree.
- **Last updated:** 2026-10-15.

**Contents:** 1. How we work · 2. Rules of the product · 3. Decisions already made · 4. Who does what ·
5. Tasks (M0–M7) · 6. Ask and collect · 7. Accounts

---

## 1. How we work

### Doing a task

1. **Pick your next task.** In section 5, take the first unticked task under your name in the earliest milestone.
   Check that everything on its **Needs** line is ticked.
2. **Work on `main`.** Pull first.
3. **Do only that task.** If you find other work, write it down as a new task in this file instead of doing it.
4. **Tick the box** of your task in this file (`- [ ]` becomes `- [x]`) in the same commit.
5. **Check the Done when line**, and run the tests. Fix anything red before pushing.
6. **Commit and push to `main`.** The commit message starts with the task number, for example
   `feat: A0.1 project skeleton`.
7. **Stuck?** Add a line `  - BLOCKED: <why>` under the task and push it.

### Rules

1. **One person changes the database at a time** (now Azim). This keeps the database history in one line.
2. **Never edit a database change that is already pushed.** Add a new one.
3. **Write the shape of each new server address** (what goes in, what comes out) in its commit message.
4. **Keys and passwords never go into git or chat.** This repository is public. Each account has one owner (section 7).
5. **New task?** Add it to this file with the next free number, an owner, a "Done when" line and a "Needs" line.
6. **Commit messages** start with `feat:`, `fix:`, `docs:`, `chore:` or `test:`, like the existing history.
7. **Every week Azim tests the website on a real tablet and a real phone** and writes any problem as a new task.

### How to read a task

```
- [ ] **Name** — `Number` What to do
  - Done when: how we know it is finished
  - Needs: tasks that must be ticked first ("—" means nothing)
```

Task numbers: **T** team setup · **A** server · **B** website · **C** videos · **V** voice and audio ·
**E** AI model · **F** launch · **Q** questions to ask · **G** things to collect.

### Keeping Claude sessions small

One task per Claude session, then a fresh session. Point Claude at this file instead of explaining the project
again.

---

## 2. Rules of the product

Every task must keep these. They come from the spec.

1. **No diagnosis and no scores for parents.** No percentages, no comparing children.
2. **Safety beats convenience.** Anything a doctor or therapist forbids never appears in a plan, a daily task or
   an assistant answer.
3. **A physiotherapist approves every video** before any family sees it.
4. **A therapist's answer wins** over a parent's answer.
5. **A missed tap is not a wrong answer.** It is saved as an "access event" and left out of the skill level.
6. **One family can never see another family's child.**
7. **The child's screens never show failure:** no timer, no red, no X, no failure sound.

---

## 3. Decisions already made

| Topic | Decision |
|---|---|
| Server | Python 3.12 + FastAPI, in the folder `apps/api/` |
| Database | PostgreSQL, with SQLAlchemy 2 and Alembic for database changes |
| Other server parts | Redis (limits, sign-in codes, background jobs), S3-style file storage (MinIO on our computers) |
| Running it | Docker Compose: one command starts the server, the database, Redis and file storage |
| Website | Next.js 16 + React 19 + TypeScript, in `apps/web/` (already built) |
| Mobile app | Paused. When it starts it will be React Native + Expo, not Flutter. The server is built ready for it |
| Old data | Not moved. The new database starts empty |
| Sign-in | Phone number + SMS code for every role. Only parents sign themselves up. The SMS is simulated for now |
| Payments | Simulated for now. Telegram, Payme and Click later |
| Exercise videos | Made with Higgsfield from one prompt per exercise, all in one fixed style. No child's name in a video. One video per exercise per language |
| AI model for the assistant | Chosen by our own blind test of several providers. No provider is fixed in advance |
| Uzbek voice | An AI voice, chosen by a listening test |
| Records of each try in a game | Sent to the server and deleted after 90 days |
| Old features (teachers, classes, email sign-in) | Hidden. Not part of the new server |

**Families**

- A child belongs to a **family**. The person who signs up is the family's **owner**.
- One second adult can join as a **helper**. A helper is for daily use only: answer the questions, mark tasks
  done, play with the child, use the assistant.
- **Only the owner** can give or take back consents, share with a therapist, delete a child, add or remove the
  helper, and pay.
- Limits: 3 children and 1 helper per family. Both numbers are settings.
- Free and Pro belong to the family.

**Where we differ from the spec** (the founders must agree — task Q1)

| The spec says | We do | Why |
|---|---|---|
| The video voice says the child's name | No name in videos | One video per exercise can be reviewed once; a personal video for each child cannot |
| Records of each try stay on the phone only | Also on the server, for 90 days | A browser can wipe its storage at any time |
| One parent account | A family with an owner and a helper | Both adults see the same child |

**Already prepared** in `apps/web/src/content/backend/`, kept up to date by the test `backend-content.test.ts`:

- `intake.json` — every parent question with its allowed answers.
- `exercises.json` — the exercise list with its safety tags. The 33 exercises are placeholders until task C1.
- `roadmap_cases.json` — 284 sample children with the exact plan the website builds for each.

---

## 4. Who does what

**Now (solo phase): Azim does every task** — the website, the server, the database, the videos, and the
questions to the founders. Inside a milestone, do the server list first, then the website list.

**Handover.** When the base and the hardest parts are done, Azim hands the project to Bekzod. At that point:
write down here which tasks are Bekzod's, bring back pull requests with one review, and turn the review rule
back on for `main` on GitHub.

---

## 5. Tasks

Milestones are done in order. Inside a milestone, each developer works down their own list from the top.

### M0 — Setup

*After this: the tools and the rules are ready.*

**Bekzod**

- [x] **Bekzod** — `T1` Install Docker and start it
  - Done when: `docker compose version` prints a version and `docker run hello-world` works
  - Needs: —
- [x] **Bekzod** — `T2` Remove `docs/backend-plan.md` from the `bekzod-dev` branch; this file replaces it
  - Done when: `TASKS.md` is the only plan file on every branch
  - Needs: T4

**Azim**

- [x] **Azim** — `T3` Finish the first screen of Docker Desktop (accept the terms, enter the Mac password)
  - Done when: `docker compose version` prints a version and `docker run hello-world` works
  - Needs: —
- [x] **Azim** — `T4` Put this file on `main` and send it to Bekzod
  - Done when: Bekzod has read it and agreed to the split, or the split is changed here
  - Needs: —
- [x] **Azim** — `T5` Protect `main` on GitHub: changes only by pull request, with one approval and green checks
  - Done when: a direct push to `main` is refused
  - Needs: T4
  - Changed 2026-10-15 for the solo phase: no review needed now; force push and deleting `main` stay blocked
- [x] **Azim** — `T6` Write one `CLAUDE.md` at the top of the repository: the rules of section 2, the working rules of section 1, and where things live
  - Done when: a new Claude session follows the rules without being told
  - Needs: T4
- [ ] **Azim** — `T7` Fill in the accounts table (section 7)
  - Done when: every account has one owner
  - Needs: —

### M1 — Real plan

*After this: a parent signs in, answers the questions and gets a real 4-week plan from the server.*

**Server — in this order**

- [x] **Azim** — `A0.1` Create the server project in `apps/api/`: FastAPI app, one folder per module, settings for ruff, mypy and pytest
  - Done when: the server starts; one test passes; ruff and mypy pass
  - Needs: T1
- [x] **Azim** — `A0.2` Docker Compose file with PostgreSQL 17, Redis and MinIO, on ports that do not clash with programs already running (for example 5433 and 6380); settings read from `.env`; a `.env.example`
  - Done when: `docker compose up` starts everything and the server reads its settings
  - Needs: A0.1
- [x] **Azim** — `A0.3` Database layer: async SQLAlchemy, shared id and time columns, Alembic, the first database change, a test database for the tests
  - Done when: `alembic upgrade head` works; the tests build a fresh test database
  - Needs: A0.2
- [x] **Azim** — `A0.4` Errors in the shape the website expects (problem+json with a code in `title`); a request number in every log line; `/healthz` and `/readyz`
  - Done when: both health addresses answer; a failing request returns the agreed shape
  - Needs: A0.1
- [x] **Azim** — `A1.1` Tables `users`, `families`, `family_members`. A user has a phone (unique), a role (`parent`, `therapist`, `physio`, `clinic`, `admin`), a status, a language, a region and a district
  - Done when: the database change applies and rolls back
  - Needs: A0.3
- [x] **Azim** — `A1.2` SMS sender with a simulated version that returns the code; `POST /auth/phone/start`
  - Done when: tests prove the 60-second resend limit, the 5-tries limit and a limit per phone and per IP address
  - Needs: A1.1
- [x] **Azim** — `A1.3` `POST /auth/phone/verify`: sign in; on first use create a parent and their family, with the parent as owner; give a short sign-in token and a long one that changes on every use
  - Done when: a test proves that using an old long token again signs the user out everywhere
  - Needs: A1.2
- [x] **Azim** — `A1.4` Sign-in by cookie for the website and by header token for the future app; protection against forged requests on cookie writes; refresh, sign out, sign out everywhere
  - Done when: both kinds of request work; a website write without the protection token is refused
  - Needs: A1.3
- [x] **Azim** — `A1.5` The server refuses to start in production while SMS is simulated
  - Done when: a test proves it
  - Needs: A1.2
- [x] **Azim** — `A1.6` `GET` and `PATCH /me`; the sign-up step (basic consent, region, district); consent texts in 4 languages
  - Done when: a new user can call nothing else before giving basic consent
  - Needs: A1.4
- [x] **Azim** — `A1.7` Roles, and one shared check "may this person see this child?": family members see their family's children, a therapist sees shared children only, everyone else gets "not found". An admin creates physiotherapist, clinic and admin accounts by phone
  - Done when: tests cover every role and family-membership combination; a non-parent with an unknown phone does not get a parent account by accident
  - Needs: A1.4
- [x] **Azim** — `A1.8` An admin can change a user's role and disable an account
  - Done when: each change is in the audit log; a disabled account is signed out at once
  - Needs: A1.7
- [x] **Azim** — `A2.1` Table `children`, linked to a family; add, list, edit, delete; at most 3 children per family
  - Done when: only members of that family see the child; only the owner can delete
  - Needs: A1.7
- [x] **Azim** — `A2.2` Child consents `health`, `movement_videos`, `therapist_share`: given and taken back by the owner only
  - Done when: taking a consent back stops the related use; a helper's attempt is refused
  - Needs: A2.1
- [x] **Azim** — `A2.3` Load the question rules from `apps/web/src/content/backend/intake.json` and check answers against them
  - Done when: an answer outside a question's allowed values is refused
  - Needs: A2.1
- [x] **Azim** — `A2.4` Tables for question rounds and answers; `PUT /children/{id}/intake/{round}` saves some answers at a time
  - Done when: "Not sure" is saved as empty; a parent can stop and continue later; health answers are not saved without the health consent
  - Needs: A2.2, A2.3
- [x] **Azim** — `A2.5` Health answers are stored encrypted
  - Done when: they are unreadable in a raw copy of the database
  - Needs: A2.4
- [ ] **Azim** — `A2.6` Write down where the encryption key lives and how it is backed up
  - Done when: a restore test on another computer reads old health answers
  - Needs: A2.5
  - BLOCKED: docs/health-key.md and `app.cli check-health-key` are ready and rehearsed on one Mac. Waiting for: the
    production host (Q4), the second key keeper and password manager, and a second computer for the real restore test
- [x] **Azim** — `A2.7` Finish a round; start the 3-month repeat with last time's answers filled in
  - Done when: a new round starts with the last answers; every old round is kept
  - Needs: A2.4
- [x] **Azim** — `A3.1` Tables for exercises, videos (one per exercise per language, with review status, who approved and when) and review notes
  - Done when: the database change applies and rolls back
  - Needs: A0.3
- [x] **Azim** — `A3.2` File storage with short-lived upload and download links
  - Done when: an upload and a download work against MinIO
  - Needs: A0.2
- [x] **Azim** — `A4.1` Tables for plans, plan items and reasons; a plan stores its engine version
  - Done when: the database change applies and rolls back
  - Needs: A2.1

**Website and content — in this order**

- [x] **Azim** — `B1` When "Next" is grey in the parent questions, show which question is still open
  - Done when: the open question is marked and scrolled into view
  - Needs: —
- [ ] **Azim** — `B46` Make the browser tests that fail now and then pass every time: `parent-gate`, `seo` (hreflang), `escape`, `gates`, `drawing` (they also fail without recent changes); on GitHub also `dashboards` (screenshot differences)
  - Done when: `npx playwright test` passes 3 runs in a row, and the `ci-web` check on GitHub is green
  - Needs: —
- [x] **Azim** — `B2` In the website's demo data and screens, make a child belong to a family instead of one parent; at most 3 children
  - Done when: demo mode uses the same shape the server will use; all tests pass
  - Needs: —
- [ ] **Azim** — `C1` Connect Higgsfield and test it on 3 exercises
  - Done when: we know the longest clip, the price per clip, and whether the same person stays the same across clips
  - Needs: T7
- [x] **Azim** — `A0.5` GitHub Actions for the server: ruff, mypy, and tests with a PostgreSQL service
  - Done when: the checks run and are green on a pull request
  - Needs: A0.3
- [x] **Azim** — `A4.2` Plan engine, part 1 — the safety filter, moved from `apps/web/src/lib/roadmap.ts` to Python as pure calculation with no database
  - Done when: tests cover every restriction, seizure, surgery and movement-level combination
  - Needs: A0.1
- [x] **Azim** — `A4.3` Plan engine, part 2 — choosing exercises and games for 28 days
  - Done when: the server gives exactly the stored plan for all 284 cases in `roadmap_cases.json`
  - Needs: A4.2
- [x] **Azim** — `A0.6` Publish the server's address description (OpenAPI) and generate the website's types from it
  - Done when: a changed address breaks the website's type check
  - Needs: A0.4
- [ ] **Azim** — `A0.7` A test server on the internet with made-up data only, updated automatically from `main`
  - Done when: the server answers at a test address after a merge
  - Needs: A0.2, T7
- [ ] **Azim** — `B3` Connect the website's sign-in and sign-up to the server
  - Done when: sign-up works in the browser against the real server, covered by a browser test
  - Needs: A1.6
- [x] **Azim** — `A2.8` Write the test "someone from family B tries to read family A's child" for every child address
  - Done when: family B always gets "not found"
  - Needs: A2.7
- [ ] **Azim** — `B4` Connect the children list and the parent questions to the server
  - Done when: a parent answers all questions in the browser against the real server, stops halfway and continues later
  - Needs: A2.7, B2
- [x] **Azim** — `A3.3` Load the exercise list from `exercises.json`; an admin registers a finished video file
  - Done when: a new video starts as "waiting for review"
  - Needs: A3.1, A3.2
- [ ] **Azim** — `A3.4` Review queue for the physiotherapist: list waiting videos; approve, reject, or ask for changes with a note
  - Done when: each decision stores who and when, and is in the audit log
  - Needs: A3.3, A1.7
- [ ] **Azim** — `A3.5` Serve videos to families
  - Done when: a test proves a parent can never fetch a video that is not approved
  - Needs: A3.4
- [ ] **Azim** — `B5` Connect the physiotherapist review page to the server, with a player for real video files
  - Done when: a physiotherapist approves a real video in the browser
  - Needs: A3.5
- [ ] **Azim** — `A4.4` Build a plan when a question round is finished; store its reasons
  - Done when: finishing a round creates a plan; the same answers always give the same plan
  - Needs: A4.3, A4.1, A2.7, A3.4
- [ ] **Azim** — `A4.5` Server address for the current plan and for today's task
  - Done when: the plan can be read by any member of the family and by nobody else
  - Needs: A4.4
- [ ] **Azim** — `B6` Connect the plan screen to the server
  - Done when: a parent sees their real 4-week plan in the browser
  - Needs: A4.5

### M2 — Daily use

*After this: a parent opens today's task, watches the video and marks it done.*

**Server — in this order**

- [ ] **Azim** — `A5.1` Tables for finished tasks, paused days, daily questions and their answers
  - Done when: the database change applies and rolls back
  - Needs: A4.1
- [ ] **Azim** — `A5.2` Background worker process (ARQ) in Docker Compose
  - Done when: a test job runs on schedule
  - Needs: A0.2
- [ ] **Azim** — `V1` Listening test: the same 20 Uzbek sentences from 3–4 voice providers (Azure Speech, Yandex SpeechKit, Muxlisa AI, Aisha)
  - Done when: native speakers chose one without knowing which was which; the price is written here
  - Needs: —
- [ ] **Azim** — `V2` Check the letter sounds that matter for children: oʻ, gʻ, q, x, h
  - Done when: a native speaker confirms the chosen voice says each one clearly
  - Needs: V1
- [ ] **Azim** — `V3` Make the voice-over for each exercise video in Uzbek, Russian and English
  - Done when: every video of task C4 has its three voice tracks
  - Needs: V2, C2

**Website and content — in this order**

- [ ] **Azim** — `C2` Write the fixed style prompt and one prompt per exercise
  - Done when: a prompt sheet exists for every exercise in the approved list
  - Needs: G1
- [ ] **Azim** — `C3` Decide the video format: how long, one clip or several joined, how the three language versions are made
  - Done when: the decision is written in section 3 of this file
  - Needs: C1
- [ ] **Azim** — `B7` Today screen on demo data: today's exercises (with video and tool) and today's games
  - Done when: it is the first screen after sign-in
  - Needs: —
- [ ] **Azim** — `B8` One-tap Done, then optional easy / OK / hard
  - Done when: two "hard" in a row lower that exercise's level, two "easy" raise it
  - Needs: B7
- [ ] **Azim** — `B9` Pause today; week view with done, today and coming days
  - Done when: a paused day is not shown as missed and the plan moves forward one day
  - Needs: B7
- [ ] **Azim** — `B10` Daily question
  - Done when: one question a day is asked and the answer is saved
  - Needs: B7
- [ ] **Azim** — `A5.3` Server: Done with easy / OK / hard
  - Done when: two "hard" lower the level and two "easy" raise it, unless a therapist fixed the level
  - Needs: A5.1, A4.5
- [ ] **Azim** — `A5.4` Server: pause today; week view
  - Done when: a paused day shifts the plan and is not counted as missed
  - Needs: A5.3
- [ ] **Azim** — `A5.5` Server: daily question
  - Done when: one question a day; the answer updates the child's profile
  - Needs: A5.1
- [ ] **Azim** — `A5.6` Server: reminder at the parent's preferred time of day
  - Done when: a reminder job runs at the right time in tests
  - Needs: A5.2, Q5
- [ ] **Azim** — `A5.7` Video links that the website and the future app can keep for 7 days offline
  - Done when: a saved video still plays offline after a week
  - Needs: A3.5
- [ ] **Azim** — `B11` Connect the Today screen to the server
  - Done when: Done, pause and the daily question work in the browser against the real server
  - Needs: A5.4, A5.5, B8, B9, B10
- [ ] **Azim** — `C4` Make the first batch of videos: the exercises that first plans use most
  - Done when: the videos are uploaded and waiting for review
  - Needs: C2, C3, A3.3
- [ ] **Azim** — `C5` The physiotherapist reviews the first batch
  - Done when: approved videos appear in real plans
  - Needs: C4, V3, A3.4, Q3
- [ ] **Azim** — `B12` Video player on the Today screen; keep the next 7 days of videos for offline use on Wi-Fi
  - Done when: today's videos play with the internet off
  - Needs: C5, A5.7

### M3 — Child play

*After this: the child does the play check and gets the right games.*

**Server — in this order**

- [ ] **Azim** — `A6.1` Tables for access settings, play check runs, skill levels, game sessions, and try records split by month
  - Done when: the database change applies; one month of tries can be dropped in a single step
  - Needs: A2.1
- [ ] **Azim** — `A6.2` Nightly job that deletes try records older than 90 days
  - Done when: old months are gone after the job runs
  - Needs: A6.1, A5.2
- [ ] **Azim** — `A6.3` Table for the parent's own My Voice cards
  - Done when: the database change applies and rolls back
  - Needs: A2.1, Q2
- [ ] **Azim** — `V4` Make all fixed audio in Uzbek, Russian and English: letters, words, game instructions
  - Done when: a list maps every item to its file; a test fails if one is missing
  - Needs: V2

**Website and content — in this order**

- [ ] **Azim** — `B13` Input layer: every game receives "select, move, hold" and never a raw tap
  - Done when: hold-to-choose and switch scanning work in every game
  - Needs: —
- [ ] **Azim** — `B14` Save every try with its access events; keep tries when the internet drops and send them later in batches
  - Done when: a missed tap, a double tap or an early release is saved as an access event, never as a wrong answer
  - Needs: B13
- [ ] **Azim** — `B15` Play check, stage 1 — hands and touch: find the input mode, the smallest button that works, the hold time, accidental repeats, clean release
  - Done when: all five access settings are found in about 2 minutes, with no timer, no red and no failure sound
  - Needs: B13
- [ ] **Azim** — `B16` Play check, stage 2 — four placement games (seeing, memory, letters, thinking); after 2 mistakes the right answer shimmers, after 4 the others fade
  - Done when: the whole play check takes under 10 minutes; a parent can stop and retry within 3 days
  - Needs: B15, G5
- [ ] **Azim** — `B17` Skill level for each of the six areas, updated after every clean try with the spec's formula; three game slots: easy win, growth, child's choice
  - Done when: unit tests match the spec's formula
  - Needs: B14
- [ ] **Azim** — `B18` 20-minute daily game limit with the sleeping cloud; at most one new game a week; an open game is never taken away
  - Done when: the limit still holds after closing and reopening the website
  - Needs: B17
- [ ] **Azim** — `A6.4` Server: access settings (`input_mode`, `min_target_mm`, `dwell_ms`, `repeat_lock`, `release_ok`)
  - Done when: values outside the spec's ranges are refused
  - Needs: A6.1
- [ ] **Azim** — `A6.5` Server: play check runs; accept batches of tries; leave access events out of the skill level
  - Done when: a batch sent twice is stored once; a test proves access events never change a skill level
  - Needs: A6.1
- [ ] **Azim** — `A6.6` Server: skill level — a starting guess from the questions, corrected by the play check by one step at most, updated after each clean try
  - Done when: unit tests match the spec's formula
  - Needs: A6.5
- [ ] **Azim** — `A6.7` Server: game choice, and game sessions with the minutes played today
  - Done when: the server enforces the 20-minute limit and "one new game a week"
  - Needs: A6.6
- [ ] **Azim** — `B19` Connect the play check, tries, skill levels and game choice to the server
  - Done when: a child finishes the play check in the browser and the next day gets games picked by the server
  - Needs: A6.4, A6.7, B16, B18
- [ ] **Azim** — `A6.8` Server: the parent's own My Voice cards, with photo and recorded voice
  - Done when: the cards are the same on every device of the family
  - Needs: A6.3, A3.2
- [ ] **Azim** — `B20` Connect My Voice cards to the server
  - Done when: a card made on one device appears on another
  - Needs: A6.8

### M4 — Therapist, helper, Free and Pro

*After this: a parent invites a therapist and a second adult; Free and Pro work with a 7-day trial.*

**Server — in this order**

- [ ] **Azim** — `A7.1` Free and Pro per family; 7-day trial of Pro
  - Done when: the trial ends on time; a helper gets the family's Pro access
  - Needs: A1.1
- [ ] **Azim** — `A7.2` Free limits enforced by the server
  - Done when: a Free family meets every limit the founders listed
  - Needs: A7.1, G3
- [ ] **Azim** — `A7.3` A simulated payment turns a family to Pro; an admin can upgrade a family by hand
  - Done when: a repeated payment message never upgrades twice; only the owner can pay
  - Needs: A7.1
- [ ] **Azim** — `A8.1` Invite a therapist by phone or link; the therapist accepts; the owner stops the share
  - Done when: stopping the share cuts the therapist's access at once
  - Needs: A2.2
- [ ] **Azim** — `A8.2` Tables and addresses for the therapist form T1–T11; a therapist's answer wins over the parent's
  - Done when: the answer in use carries the therapist's name, so the parent side can show "Updated by …"
  - Needs: A8.1
- [ ] **Azim** — `A8.3` Movement and feedback clips, allowed only with the movement-videos consent; the therapist replies
  - Done when: only the shared therapist can watch; the parent can delete any clip
  - Needs: A8.1, A3.2
- [ ] **Azim** — `A8.4` Helpers: the owner invites one second adult by phone; the helper accepts; the owner removes them
  - Done when: a helper can do daily use only (section 3); removal cuts access at once
  - Needs: A2.1

**Website and content — in this order**

- [ ] **Azim** — `B21` Free and Pro screens, the 7-day trial, the Free limits, a reminder 2 days before the trial ends
  - Done when: only the owner sees the pay button
  - Needs: G3
- [ ] **Azim** — `B22` Connect Free and Pro to the server
  - Done when: a simulated payment upgrades the family in the browser
  - Needs: A7.2, A7.3, B21
- [ ] **Azim** — `B23` Therapist form T1–T11
  - Done when: the required fields follow the therapist's profession, as the spec lists them
  - Needs: —
- [ ] **Azim** — `B24` Parent side: "Updated by [therapist name]" and the therapist's message
  - Done when: the parent sees whose answer is in use
  - Needs: B23
- [ ] **Azim** — `B25` Therapist assigns or excludes exercises; watches clips and replies
  - Done when: an excluded exercise never comes back into the plan
  - Needs: B23
- [ ] **Azim** — `A8.5` Server: rebuild the plan when a therapist changes restrictions, goals or exercises
  - Done when: a test proves a therapist's restriction never appears in the new plan
  - Needs: A8.2, A4.4
- [ ] **Azim** — `B26` Connect the therapist invite, form, exercise choice and clips to the server
  - Done when: a therapist changes a restriction in the browser and the parent's plan changes
  - Needs: A8.3, A8.5, B24, B25
- [ ] **Azim** — `B27` Helper screens: invite, accept, remove; hide owner-only buttons from a helper
  - Done when: a helper never sees the consent, sharing, delete or pay buttons
  - Needs: B2
- [ ] **Azim** — `B28` Connect the helper screens to the server
  - Done when: a helper signs in with their own phone and sees the family's child
  - Needs: A8.4, B27

### M5 — Assistant

*After this: a parent or therapist asks the assistant by text or by voice.*

**Server — in this order**

- [ ] **Azim** — `E1` Write 30 real parent questions in Uzbek Latin, Uzbek Cyrillic and Russian, each with the safe answer described
  - Done when: a therapist has read and corrected them
  - Needs: —
- [ ] **Azim** — `E2` Blind test of the low-cost model from at least 3 AI providers on those questions
  - Done when: a native speaker rated the answers without seeing the provider; the winner and its price are written in section 3
  - Needs: E1
- [ ] **Azim** — `V5` Choose speech-to-text for Uzbek and Russian
  - Done when: a test with real parent voices is good enough to use; the choice is written in section 3
  - Needs: —
- [ ] **Azim** — `A9.1` Tables for chats, messages and AI usage
  - Done when: the database change applies and rolls back
  - Needs: A2.1

**Website and content — in this order**

- [ ] **Azim** — `B29` Assistant screen: emergency words (seizure, trouble breathing, a fall with a head injury, sudden strong pain) show **103** before anything else
  - Done when: tested in all 4 languages
  - Needs: —
- [ ] **Azim** — `A9.2` Server: the AI provider behind one setting, with a fake one for tests; a daily message limit; the child's name and birth date are never sent
  - Done when: a Free family gets about 20 messages a day; a test proves requests contain no child name
  - Needs: A9.1, E2, G7
- [ ] **Azim** — `A9.3` Server: emergency words in 4 languages return **103** before any AI call; every answer is checked against the child's restrictions
  - Done when: tested in all 4 languages
  - Needs: A9.2
- [ ] **Azim** — `A9.4` Server: store chats; the parent can delete them; a summary for the therapist
  - Done when: the therapist gets topics and warnings only, never the full chat
  - Needs: A9.2
- [ ] **Azim** — `A9.5` Server: the weekly two-sentence summary and the plan explanation, written only from stored facts
  - Done when: a test proves the text contains no fact that was not given
  - Needs: A9.2, A5.3
- [ ] **Azim** — `A9.6` Server: a monthly spending limit for AI
  - Done when: the assistant falls back to fixed answers when the limit is reached
  - Needs: A9.2
- [ ] **Azim** — `B30` Assistant knows the child's plan, finished tasks and restrictions
  - Done when: it never suggests a forbidden exercise
  - Needs: A9.3
- [ ] **Azim** — `B31` Assistant in the therapist dashboard; summary of the parent's chats
  - Done when: the therapist never sees the full chat
  - Needs: A9.4
- [ ] **Azim** — `A9.7` Server: speak a question and hear the answer
  - Done when: it works in 4 languages
  - Needs: A9.2, V5, V2
- [ ] **Azim** — `B32` Assistant voice: a microphone button and a "read aloud" button
  - Done when: it works in 4 languages in the browser
  - Needs: A9.7
- [ ] **Azim** — `B33` Connect the assistant screens to the server
  - Done when: a real question gets a real answer in the browser
  - Needs: A9.5, B29, B30, B31

### M6 — Find help, booking, Home Kit

*After this: a parent finds a clinic, books a visit and orders a kit.*

**Server — in this order**

- [ ] **Azim** — `A10.1` Table of places; an admin adds and edits places
  - Done when: a place has every field the spec lists
  - Needs: A1.7
- [ ] **Azim** — `A10.2` Search: free state centres first, then by distance; a parent reports wrong information
  - Done when: a price older than 6 months says "price not recently checked"; a report flags the place
  - Needs: A10.1
- [ ] **Azim** — `A10.3` Clinic accounts and their free times
  - Done when: a clinic sees only its own data
  - Needs: A1.7
- [ ] **Azim** — `A10.4` Booking, confirm and cancel, in person or online
  - Done when: the database makes a double booking impossible
  - Needs: A10.3
- [ ] **Azim** — `A10.5` Reminders 1 day and 2 hours before a visit
  - Done when: the reminder jobs run on time in tests
  - Needs: A10.4, A5.2
- [ ] **Azim** — `A11.1` Home Kit products, orders and delivery status
  - Done when: an order goes from placed to delivered
  - Needs: A1.1, G3
- [ ] **Azim** — `A11.2` The allergy question (P17a) is checked before an order is accepted
  - Done when: an order is refused until the question is answered
  - Needs: A11.1

**Website and content — in this order**

- [ ] **Azim** — `B34` Find help screen: pick a need, see places (free first, then by distance), report wrong information
  - Done when: "I'm not sure" suggests the child's doctor or a free state centre and never guesses
  - Needs: G2
- [ ] **Azim** — `B35` Booking screen: free times, book in person or online
  - Done when: a taken time cannot be chosen
  - Needs: G4
- [ ] **Azim** — `B36` Clinic dashboard: publish free times, confirm or cancel, add an online link
  - Done when: a clinic sees only its own bookings
  - Needs: G4
- [ ] **Azim** — `B37` Connect Find help, booking and the clinic dashboard to the server
  - Done when: a parent books a real free time in the browser and the clinic confirms it
  - Needs: A10.2, A10.5, B34, B35, B36
- [ ] **Azim** — `B38` Home Kit order screen: allergy question, address, delivery or pickup
  - Done when: the order button stays off until the allergy question is answered
  - Needs: G3
- [ ] **Azim** — `B39` Connect the Home Kit order to the server
  - Done when: an order placed in the browser appears for the admin
  - Needs: A11.2, B38

### M7 — Launch

*After this: real families use it.*

**Server — in this order**

- [ ] **Azim** — `A12.1` See and download everything stored about a child
  - Done when: the file contains all personal data of the child
  - Needs: A2.7
- [ ] **Azim** — `A12.2` Delete a child or the whole account; the data is removed for good within 30 days
  - Done when: the data is gone from the database after the job runs
  - Needs: A12.1, A5.2
- [ ] **Azim** — `A12.3` Delete any clip or chat; stop any share
  - Done when: each works at once
  - Needs: A8.3, A9.4
- [ ] **Azim** — `A13.1` Second sign-in step for admins
  - Done when: an admin cannot act with only a stolen SMS code
  - Needs: A1.7
- [ ] **Azim** — `A13.2` Connect a real SMS provider
  - Done when: a real phone receives a real code
  - Needs: Q6
- [ ] **Azim** — `A13.3` Production Docker files with HTTPS
  - Done when: the server runs on a fresh machine with HTTPS
  - Needs: Q4
- [ ] **Azim** — `A13.4` Put the server live
  - Done when: the server answers at the real address
  - Needs: A13.3, A13.2, F1
- [ ] **Azim** — `A13.5` Nightly encrypted backups, and one practice restore
  - Done when: a restore has been done once and the steps are written down
  - Needs: A13.4
- [ ] **Azim** — `A13.6` Error alerts and uptime checks
  - Done when: an alert arrives when the server is stopped on purpose
  - Needs: A13.4
- [ ] **Azim** — `F3` Security check before launch
  - Done when: no serious finding is open
  - Needs: A13.4
- [ ] **Azim** — `F4` Load test: many children playing at once
  - Done when: the server stays fast at the pilot's expected size
  - Needs: A13.4

**Website and content — in this order**

- [ ] **Azim** — `B40` "Everything we store about your child" in plain words; delete one video or one chat
  - Done when: each delete works at once on demo data
  - Needs: —
- [ ] **Azim** — `B41` Connect seeing, downloading and deleting your data to the server
  - Done when: a parent downloads their child's data in the browser
  - Needs: A12.3, B40
- [ ] **Azim** — `B42` Remove scores and percentages from every parent screen
  - Done when: no parent screen shows a score, a percentage or a comparison of children
  - Needs: —
- [ ] **Azim** — `B43` New text for the public pages and the pricing page
  - Done when: they describe the new product, not the old 16 levels
  - Needs: G3
- [ ] **Azim** — `B44` Native-speaker check of the Uzbek Latin, Uzbek Cyrillic and Russian text
  - Done when: a named person has signed off each language
  - Needs: —
- [ ] **Azim** — `B45` Remove the hidden old features, or keep them hidden
  - Done when: the founders' answer is carried out
  - Needs: Q7
- [ ] **Azim** — `V6` Replace the device voice in games and My Voice with the audio files
  - Done when: no game uses the device voice when a file exists
  - Needs: V4
- [ ] **Azim** — `C6` Make the remaining exercise videos, in batches, and get them reviewed
  - Done when: every exercise in the approved list has an approved video in 3 languages
  - Needs: C5
- [ ] **Azim** — `F1` Buy the domain name and point it at the server
  - Done when: the address opens with HTTPS
  - Needs: Q4
- [ ] **Azim** — `F2` Build and release the website for production
  - Done when: the website opens at the real address and talks to the real server
  - Needs: A13.4
- [ ] **Azim** — `F5` Pilot with real families in Tashkent
  - Done when: the spec's pilot numbers (section 17 of the spec) are being measured
  - Needs: F2, F3, Q4, G6, G7

---

## 6. Ask and collect

These are not programming. The named developer asks the right person and writes the answer **in this file**
(in section 3 for a decision). Do them early: each one unblocks the tasks on its "Needed for" line.

**Azim**

- [ ] **Azim** — `Q1` Send the founders the three differences from the spec (section 3) and get their answer in writing
  - Needed for: A6.1, C2
- [ ] **Azim** — `Q2` Ask the founders: do the child games and My Voice get server support in the first version? Recommended: yes
  - Needed for: A6.3
- [ ] **Azim** — `Q3` Ask the founders: who is the reviewing physiotherapist, and how many videos a week can they review?
  - Needed for: C5
- [ ] **Azim** — `Q4` Ask the founders and the lawyer: hosting at Contabo, or on a server in Uzbekistan?
  - Needed for: A13.3, F1, F5
- [ ] **Azim** — `Q5` Ask the founders: reminders by browser notification, Telegram or SMS? Recommended: Telegram first
  - Needed for: A5.6
- [ ] **Azim** — `Q7` Ask the founders: delete the old features (teachers, classes, email sign-in), or keep them hidden?
  - Needed for: B45
- [ ] **Azim** — `Q8` Ask the founders: which Telegram payment flow, and when Payme and Click?
  - Needed for: real payments after the pilot
- [ ] **Azim** — `Q9` Ask the founders: when does the mobile app start? Recommended: after M2
  - Needed for: planning only
- [ ] **Azim** — `Q10` Ask Shoxjahon once whether the `web-backend` server branch exists anywhere. If it is not found in a few days, stop looking
  - Needed for: nothing; it could save work
- [ ] **Azim** — `G1` Get the final exercise list, approved by a physiotherapist: name, steps and safety tags for each exercise
  - Needed for: C2
- [ ] **Azim** — `G2` Get about 40 checked places in Tashkent: name, type, district, map link, contacts, languages, ages, works with CP, price range, date checked
  - Needed for: B34
- [ ] **Azim** — `G3` Get the Pro price, the exact Free contents, the Home Kit price and the exact items in the box
  - Needed for: A7.2, A11.1, B21, B38, B43
- [ ] **Azim** — `G4` Get the partner clinics and their free times
  - Needed for: B35, B36
- [ ] **Azim** — `G5` Get the game catalogue (3 → 20 games) and the onboarding assessment document, both named as sources in the spec
  - Needed for: B16
- [ ] **Azim** — `G6` Get the final consent texts in 4 languages. They must say that try records are kept on the server for 90 days
  - Needed for: F5
- [ ] **Azim** — `G7` Get the lawyer's answers: may children's health data be stored abroad, and may data be sent to AI and voice companies abroad?
  - Needed for: A9.2, F5

- [ ] **Azim** — `Q6` Compare SMS providers (Eskiz.uz and others): price and how to connect
  - Needed for: A13.2

---

## 7. Accounts

One owner for each. The owner keeps the password and the keys. Nothing from this table goes into git or chat.

| Account | Owner |
|---|---|
| GitHub repository | Azim |
| Test server | ___ |
| Production hosting | ___ |
| Domain name | ___ |
| Higgsfield | ___ |
| AI provider key | ___ |
| Voice provider key | ___ |
| SMS provider | ___ |
