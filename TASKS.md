# FlexiKeys — Tasks

This is the **only plan file** of the project. Everything left to build is here, as small tasks, each with the
name of the developer who does it.

> **Solo phase (since 2026-10-15):** Azim builds alone — the base and the hardest parts — and then hands the
> project to Bekzod (see "Handover" in section 4). Every open task is Azim's until then. No reviews.

- **What we are building** is described in the founders' spec: `docs/product-spec-2026-10-06.pdf`. Where this file
  and the spec disagree, the spec wins — except for the three points listed in section 3.
- `PRD.md` is the older product document. The spec replaced the parts where they disagree.
- **Last updated:** 2026-10-30.

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

Claude works through this file in a `/loop`: one task at a time, a plain-language report after each, compacting the
conversation when it gets long. It skips tasks that wait for Azim (keys, people, content, decisions) and stops when
only those are left. Point Claude at this file instead of explaining the project again.

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
| Mobile app | Starts after launch (Q9). React Native + Expo, not Flutter. The server is built ready for it |
| Old data | Not moved. The new database starts empty |
| Sign-in | Phone number + SMS code for every role. Only parents sign themselves up. The SMS is simulated until launch (Q6) |
| Payments | Simulated until after the pilot (Q8). Telegram, Payme and Click later |
| Exercise videos | Made with Higgsfield from one prompt per exercise, all in one fixed style. No child's name in a video. One video per exercise per language |
| AI model for the assistant | Chosen by our own blind test of several providers. No provider is fixed in advance |
| Uzbek voice | An AI voice, chosen by a listening test |
| Parent questions | The CEO's "FlexiKeys Parent Intake Questionnaire" (16 Oct 2026, therapist-reviewed; kept outside the repo in `~/code/flexikeys-docs/`) replaces P1–P41 (Azim, 2026-10-22). The 9 open points in the CTO package review stay open until the CEO answers; the build keeps them easy to change |
| Founders' answers (22 Oct 2026) | Charos's "Answers to the CTO package review" (file kept outside the repo): speech delay joins the diagnosis list; ~~ages 3–12~~ (replaced 30 Oct 2026: ages 2–18, and age never limits the plan, see below); no Uzbek Cyrillic (Uzbek Latin, Russian, English); 12-week plan in 3 steps with a short re-check and video every month; therapist approval is Pro only, Free gets a limited safe-only plan (but also "the therapist approves every plan before the parent sees it": Q14); one soft-3D video per exercise with an ordinary-looking AI-made child; home massage later, not in the first release; Home Kit optional, exercises use household things; AI chooses the plan inside the rules' safe list. Confirmed: the new questionnaire replaces P1–P41; CP and DCD full plan, delay or not sure limited plan, autism games and My Voice, Down syndrome through the therapist. Work: M9 |
| Records of each try in a game | Sent to the server and deleted after 90 days |
| Old features (teachers, classes, email sign-in) | Deleted (Q7, task B45). Not part of the new server |
| Hosting | Contabo (Q4). A lawyer must still confirm before the pilot that children's health data may be stored in Germany (G7) |
| Reminders | None on the website (Q5). They come with the mobile app, after launch |
| Child games and My Voice | Saved on the server too (Q2), so progress is the same on every device |
| AI | Through OpenRouter: one key (`OPENROUTER_API_KEY`), models compared by the blind test E2. **AI builds every child's plan** (Azim, 2026-10-25): it decides only from Azim's research papers and data set (A9.8), and only inside the rules' safe list (A4.6). The fixed rules still remove everything forbidden first, and the rules plan is used only when the AI fails. AI also explains, summarises and answers, and drafts text a person checks |
| Therapists approve videos only (Azim, 2026-10-25) | A physiotherapist approves each exercise video, and an approved video goes out on the website. That is the therapists' only approval job for now. **No therapist approves a plan**, and no parent waits for one. A family may still link a therapist (Pro): that therapist's answers and restrictions win over the parent's (rule 4) and rebuild the plan. This replaces "the therapist approves every plan before the parent sees it" in the founders' answers of 22 Oct (FA5, Q14 point 1) |
| No "Not sure" on family facts (Bekzod, 30 Oct 2026) | "Not sure" is removed from A3, A4, A4_kg, A5, A7, A9, B1 and the body-parts question B3_parts. It stays on skill questions a parent may not have seen (head control, crawling, picking up...). This replaces the spec §5 rule ("every required question except name, birthday, district and language has 'Not sure'") for these questions only |
| Ages 2 to 18 (founders to Bekzod, 30 Oct 2026) | FlexiKeys is for children aged 2 to 18. Replaces "ages 3–12" in the founders' answers of 22 Oct |
| Age never limits the plan (founders, 30 Oct 2026) | Every child aged 2–18 gets a plan made for them from the parent's answers and the child's results in the games. No "limited plan because of age" and no "flag for the therapist because of age". Age may still choose age-fitting content (game levels, exercises for small or big children); it never cuts the plan down. Other reasons for the limited plan (Free, "delay or not sure" in FA6) are not part of this decision |
| Videos and voice | Higgsfield (videos) and ElevenLabs (voice), bought after Azim tests them; ElevenLabs' Uzbek is checked by native speakers first (V1, V2). Until then every video and audio spot holds a placeholder (C7) |
| Research library | Open research about cerebral palsy, free to use. The assistant answers from it and names the source (A9.8) |

**Families**

- A child belongs to a **family**. The person who signs up is the family's **owner**.
- One second adult can join as a **helper**. A helper is for daily use only: answer the questions, mark tasks
  done, play with the child, use the assistant.
- **Only the owner** can give or take back consents, share with a therapist, delete a child, add or remove the
  helper, and pay.
- Limits: 3 children and 1 helper per family. Both numbers are settings.
- Free and Pro belong to the family.

**Where we differ from the spec** (agreed by the founders, Q1)

| The spec says | We do | Why |
|---|---|---|
| The video voice says the child's name | No name in videos | One video per exercise can be reviewed once; a personal video for each child cannot |
| Records of each try stay on the phone only | Also on the server, for 90 days | A browser can wipe its storage at any time |
| One parent account | A family with an owner and a helper | Both adults see the same child |
| The plan comes from fixed rules, not from an AI guessing (§13) | AI builds the plan from the research data set, inside the rules' safe list (Azim, 2026-10-25) | A plan that follows the research and the child, while the rules still keep every forbidden item out |

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

**Handover started 2026-10-25.** Bekzod does the rest of the code. Azim keeps the tasks that need a key, a
purchase, a person or a founders' answer. Bekzod starts with `A4.7` and `A4.8` (the AI plan for every family,
and plans that never wait for a therapist).

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
- [x] **Azim** — `T7` Fill in the accounts table (section 7)
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
- [x] **Azim** — `B46` Make the browser tests that fail now and then pass every time: `parent-gate`, `seo` (hreflang), `escape`, `gates`, `drawing` (they also fail without recent changes); on GitHub also `dashboards` (screenshot differences)
  - Done when: `npx playwright test` passes 3 runs in a row, and the `ci-web` check on GitHub is green
  - Needs: —
- [x] **Azim** — `B2` In the website's demo data and screens, make a child belong to a family instead of one parent; at most 3 children
  - Done when: demo mode uses the same shape the server will use; all tests pass
  - Needs: —
- [ ] **Azim** — `C1` Connect Higgsfield and test it on 3 exercises
  - Done when: we know the longest clip, the price per clip, and whether the same person stays the same across clips
  - Needs: T7
  - BLOCKED: waits for Azim to test Higgsfield and buy it (HIGGSFIELD_API_KEY in apps/api/.env)
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
  - BLOCKED: needs a Contabo server bought by Azim (Q4), and its login kept outside git
- [x] **Azim** — `B3` Connect the website's sign-in and sign-up to the server
  - Done when: sign-up works in the browser against the real server, covered by a browser test
  - Needs: A1.6
- [x] **Azim** — `A0.8` Run the live browser tests (`apps/web/e2e-live/`) against the new server on GitHub: start the server, PostgreSQL, Redis and MinIO from `apps/api/compose.yaml`; remove `journey.e2e.ts` and the old backend image, which test the old backend
  - Done when: `e2e-live` is green on GitHub with `signup.e2e.ts`
  - Needs: B3
- [x] **Azim** — `A2.8` Write the test "someone from family B tries to read family A's child" for every child address
  - Done when: family B always gets "not found"
  - Needs: A2.7
- [x] **Azim** — `B4` Connect the children list and the parent questions to the server
  - Done when: a parent answers all questions in the browser against the real server, stops halfway and continues later
  - Needs: A2.7, B2
- [x] **Azim** — `A2.9` Keep the parent's own-words answer extras on the server: the P39 voice note (a file in storage) and the hints they kept
  - Done when: a voice note recorded in the browser plays again after signing in on another device
  - Needs: A3.2, B4
- [x] **Azim** — `A3.3` Load the exercise list from `exercises.json`; an admin registers a finished video file
  - Done when: a new video starts as "waiting for review"
  - Needs: A3.1, A3.2
- [x] **Azim** — `A3.4` Review queue for the physiotherapist: list waiting videos; approve, reject, or ask for changes with a note
  - Done when: each decision stores who and when, and is in the audit log
  - Needs: A3.3, A1.7
- [x] **Azim** — `A3.5` Serve videos to families
  - Done when: a test proves a parent can never fetch a video that is not approved
  - Needs: A3.4
- [x] **Azim** — `B5` Connect the physiotherapist review page to the server, with a player for real video files
  - Done when: a physiotherapist approves a real video in the browser
  - Needs: A3.5
- [x] **Azim** — `A4.4` Build a plan when a question round is finished; store its reasons
  - Done when: finishing a round creates a plan; the same answers always give the same plan
  - Needs: A4.3, A4.1, A2.7, A3.4
- [x] **Azim** — `A4.5` Server address for the current plan and for today's task
  - Done when: the plan can be read by any member of the family and by nobody else
  - Needs: A4.4
- [x] **Azim** — `B48` Admin screen to upload a finished video file for an exercise and language (live mode: upload link, file straight to storage, register)
  - Done when: an admin uploads a file in the browser and it appears in the physiotherapist's queue
  - Needs: B5
- [x] **Azim** — `A1.9` Staff (physiotherapist, clinic, admin) sign in without the parent's basic consent and district step
  - Done when: a new physiotherapist goes straight to the review queue after the SMS code
  - Needs: B5
- [x] **Azim** — `B6` Connect the plan screen to the server
  - Done when: a parent sees their real 4-week plan in the browser
  - Needs: A4.5

### M2 — Daily use

*After this: a parent opens today's task, watches the video and marks it done.*

**Server — in this order**

- [x] **Azim** — `A5.1` Tables for finished tasks, paused days, daily questions and their answers
  - Done when: the database change applies and rolls back
  - Needs: A4.1
- [x] **Azim** — `A5.2` Background worker process (ARQ) in Docker Compose
  - Done when: a test job runs on schedule
  - Needs: A0.2
- [ ] **Azim** — `V1` Listening test: the same 20 Uzbek sentences from ElevenLabs (main candidate) and 1–2 others (Azure Speech, Muxlisa AI or Aisha)
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
- [x] **Azim** — `B7` Today screen on demo data: today's exercises (with video and tool) and today's games
  - Done when: it is the first screen after sign-in
  - Needs: —
- [x] **Azim** — `B8` One-tap Done, then optional easy / OK / hard
  - Done when: two "hard" in a row lower that exercise's level, two "easy" raise it
  - Needs: B7
- [x] **Azim** — `B9` Pause today; week view with done, today and coming days
  - Done when: a paused day is not shown as missed and the plan moves forward one day
  - Needs: B7
- [x] **Azim** — `B10` Daily question
  - Done when: one question a day is asked and the answer is saved
  - Needs: B7
- [x] **Azim** — `A5.3` Server: Done with easy / OK / hard
  - Done when: two "hard" lower the level and two "easy" raise it, unless a therapist fixed the level
  - Needs: A5.1, A4.5
- [x] **Azim** — `A5.4` Server: pause today; week view
  - Done when: a paused day shifts the plan and is not counted as missed
  - Needs: A5.3
- [x] **Azim** — `A5.5` Server: daily question
  - Done when: one question a day; the answer updates the child's profile
  - Needs: A5.1
- [ ] **Azim** — `A5.6` Server: reminder at the parent's preferred time of day
  - Done when: a reminder job runs at the right time in tests
  - Needs: A5.2, the mobile app (Q5: no reminders on the website)
- [x] **Azim** — `A5.7` Video links that the website and the future app can keep for 7 days offline
  - Done when: a saved video still plays offline after a week
  - Needs: A3.5
- [x] **Azim** — `B11` Connect the Today screen to the server
  - Done when: Done, pause and the daily question work in the browser against the real server
  - Needs: A5.4, A5.5, B8, B9, B10
- [ ] **Azim** — `C4` Make the first batch of videos: the exercises that first plans use most
  - Done when: the videos are uploaded and waiting for review
  - Needs: C2, C3, A3.3
- [ ] **Azim** — `C5` The physiotherapist reviews the first batch
  - Done when: approved videos appear in real plans
  - Needs: C4, V3, A3.4, Q3
- [x] **Azim** — `C7` Placeholder video for every exercise: a short silent clip with the exercise name and steps, in uz, ru and en; on test servers only, never in production
  - Done when: every exercise in a demo plan plays its placeholder; production refuses placeholder files
  - Needs: A3.5
- [ ] **Azim** — `B12` Video player on the Today screen; keep the next 7 days of videos for offline use on Wi-Fi
  - Done when: today's videos play with the internet off
  - Needs: C5, A5.7
- [x] **Azim** — `B49` Demo dates in Tashkent time: the demo plan's start date (lib/api/intake.ts) and the plan view's "today" (PlanTab) use the UTC date, so from midnight to 5 am they are one day behind the Today screen
  - Done when: a demo plan made at 1 am Tashkent time starts that day, and the plan view marks the same day as Today
  - Needs: —
- [x] **Azim** — `B50` The 4-week plan view moves its dates with paused days, like the Today screen does (`sel.planDayOn`)
  - Done when: after a pause, the plan view and the Today screen show the same plan day for each date
  - Needs: B9

### M3 — Child play

*After this: the child does the play check and gets the right games.*

**Server — in this order**

- [x] **Azim** — `A6.1` Tables for access settings, play check runs, skill levels, game sessions, and try records split by month
  - Done when: the database change applies; one month of tries can be dropped in a single step
  - Needs: A2.1
- [x] **Azim** — `A6.2` Nightly job that deletes try records older than 90 days
  - Done when: old months are gone after the job runs
  - Needs: A6.1, A5.2
- [x] **Azim** — `A6.3` Table for the parent's own My Voice cards
  - Done when: the database change applies and rolls back
  - Needs: A2.1, Q2
- [ ] **Azim** — `V4` Make all fixed audio in Uzbek, Russian and English: letters, words, game instructions
  - Done when: a list maps every item to its file; a test fails if one is missing
  - Needs: V2

**Website and content — in this order**

- [x] **Azim** — `B13` Input layer: every game receives "select, move, hold" and never a raw tap
  - Done when: hold-to-choose and switch scanning work in every game
  - Needs: —
- [x] **Azim** — `B14` Save every try with its access events; keep tries when the internet drops and send them later in batches
  - Done when: a missed tap, a double tap or an early release is saved as an access event, never as a wrong answer
  - Needs: B13
- [x] **Azim** — `B15` Play check, stage 1 — hands and touch: find the input mode, the smallest button that works, the hold time, accidental repeats, clean release
  - Done when: all five access settings are found in about 2 minutes, with no timer, no red and no failure sound
  - Needs: B13
- [ ] **Azim** — `B16` Play check, stage 2 — four placement games (seeing, memory, letters, thinking); after 2 mistakes the right answer shimmers, after 4 the others fade
  - Done when: the whole play check takes under 10 minutes; a parent can stop and retry within 3 days
  - Needs: B15, G5
- [x] **Azim** — `B17` Skill level for each of the six areas, updated after every clean try with the spec's formula; three game slots: easy win, growth, child's choice
  - Done when: unit tests match the spec's formula
  - Needs: B14
- [ ] **Azim** — `C8` The physiotherapist checks the skill model's first guesses: which intake answers start each of the six areas, and how hard each world level is (`apps/web/src/lib/skill.ts`, `AREA_QUESTIONS` and `difficulty`), and how a therapist's GMFCS level maps to the parent's walking answer P12 (`apps/api/app/modules/therapists/form.py`, `GMFCS_TO_P12`)
  - Done when: the physiotherapist agreed or the numbers are changed, and the tests still pass
  - Needs: B17, Q3
- [x] **Azim** — `B18` 20-minute daily game limit with the sleeping cloud; at most one new game a week; an open game is never taken away
  - Done when: the limit still holds after closing and reopening the website
  - Needs: B17
- [x] **Azim** — `A6.4` Server: access settings (`input_mode`, `min_target_mm`, `dwell_ms`, `repeat_lock`, `release_ok`)
  - Done when: values outside the spec's ranges are refused
  - Needs: A6.1
- [x] **Azim** — `A6.5` Server: play check runs; accept batches of tries; leave access events out of the skill level
  - Done when: a batch sent twice is stored once; a test proves access events never change a skill level
  - Needs: A6.1
- [x] **Azim** — `A6.6` Server: skill level — a starting guess from the questions, corrected by the play check by one step at most, updated after each clean try
  - Done when: unit tests match the spec's formula
  - Needs: A6.5
- [x] **Azim** — `A6.7` Server: game choice, and game sessions with the minutes played today
  - Done when: the server enforces the 20-minute limit and "one new game a week"
  - Needs: A6.6
- [ ] **Azim** — `B19` Connect the play check, tries, skill levels and game choice to the server
  - Done when: a child finishes the play check in the browser and the next day gets games picked by the server
  - Needs: A6.4, A6.7, B16, B18
- [x] **Azim** — `A6.8` Server: the parent's own My Voice cards, with photo and recorded voice
  - Done when: the cards are the same on every device of the family
  - Needs: A6.3, A3.2
- [x] **Azim** — `B20` Connect My Voice cards to the server
  - Done when: a card made on one device appears on another
  - Needs: A6.8

### M4 — Therapist, helper, Free and Pro

*After this: a parent invites a therapist and a second adult; Free and Pro work with a 7-day trial.*

**Server — in this order**

- [x] **Azim** — `A7.1` Free and Pro per family; 7-day trial of Pro
  - Done when: the trial ends on time; a helper gets the family's Pro access
  - Needs: A1.1
- [x] **Azim** — `A7.2` Free limits enforced by the server
  - Done when: a Free family meets every limit the founders listed
  - Needs: A7.1, G3 (placeholders for now)
- [x] **Azim** — `A7.3` A simulated payment turns a family to Pro; an admin can upgrade a family by hand
  - Done when: a repeated payment message never upgrades twice; only the owner can pay
  - Needs: A7.1
- [x] **Azim** — `A8.1` Invite a therapist by phone or link; the therapist accepts; the owner stops the share
  - Done when: stopping the share cuts the therapist's access at once
  - Needs: A2.2
- [x] **Azim** — `A8.2` Tables and addresses for the therapist form T1–T11; a therapist's answer wins over the parent's
  - Done when: the answer in use carries the therapist's name, so the parent side can show "Updated by …"
  - Needs: A8.1
- [x] **Azim** — `A8.3` Movement and feedback clips, allowed only with the movement-videos consent; the therapist replies
  - Done when: only the shared therapist can watch; the parent can delete any clip
  - Needs: A8.1, A3.2
- [x] **Azim** — `A8.4` Helpers: the owner invites one second adult by phone; the helper accepts; the owner removes them
  - Done when: a helper can do daily use only (section 3); removal cuts access at once
  - Needs: A2.1

**Website and content — in this order**

- [x] **Azim** — `B21` Free and Pro screens, the 7-day trial, the Free limits, a reminder 2 days before the trial ends
  - Done when: only the owner sees the pay button
  - Needs: G3 (placeholders for now)
- [x] **Azim** — `B22` Connect Free and Pro to the server
  - Done when: a simulated payment upgrades the family in the browser
  - Needs: A7.2, A7.3, B21
- [x] **Azim** — `B55` Old plan pieces left on the website: the old 16-level map's "Needs the Family plan" lock (`sel.entitled`) and the admin's Subscriptions page still read the old per-person subscriptions, not the family's Free/Pro. Move both to the family plan, or remove them with the old levels when G5 brings the new games
  - Done when: no screen reads `db.subscriptions`
  - Needs: B22
- [x] **Azim** — `B23` Therapist form T1–T11
  - Done when: the required fields follow the therapist's profession, as the spec lists them
  - Needs: —
- [x] **Azim** — `B24` Parent side: "Updated by [therapist name]" and the therapist's message
  - Done when: the parent sees whose answer is in use
  - Needs: B23
- [x] **Azim** — `B25` Therapist assigns or excludes exercises; watches clips and replies
  - Done when: an excluded exercise never comes back into the plan
  - Needs: B23
- [x] **Azim** — `A8.5` Server: rebuild the plan when a therapist changes restrictions, goals or exercises
  - Done when: a test proves a therapist's restriction never appears in the new plan
  - Needs: A8.2, A4.4
- [ ] **Azim** — `A8.6` Movement and feedback clips encrypted at rest in storage (spec §15 "encrypted storage"), for example MinIO server-side encryption with a key kept like the health key
  - Done when: a clip file read straight from the storage disk is not watchable
  - Needs: A8.3, A2.6
- [x] **Azim** — `A8.7` "Voice recording" consent on the server (G8): a new consent kind; a My Voice card takes a recorded voice only while it is given, and withdrawing it deletes the recorded voices
  - Done when: in live mode a card's recorded voice saves with the consent, is refused without it, and is gone after withdrawing
  - Needs: G8
- [x] **Azim** — `A8.8` A phone invite to a therapist sends an SMS with the invite link (G9), through the SMS sender (shown on screen until Q6)
  - Done when: a test sees one SMS with the link per phone invite, and none for a link-only invite
  - Needs: G9
- [x] **Azim** — `B26` Connect the therapist invite, form, exercise choice and clips to the server
  - Done when: a therapist changes a restriction in the browser and the parent's plan changes
  - Needs: A8.3, A8.5, B24, B25
- [x] **Azim** — `B27` Helper screens: invite, accept, remove; hide owner-only buttons from a helper
  - Done when: a helper never sees the consent, sharing, delete or pay buttons
  - Needs: B2
- [x] **Azim** — `B28` Connect the helper screens to the server
  - Done when: a helper signs in with their own phone and sees the family's child
  - Needs: A8.4, B27
- [x] **Azim** — `B51` Today: the parent may film the child doing one exercise (optional feedback clip, spec §8), only with the movement-videos consent; the therapist sees it with the movement clips and replies
  - Done when: a feedback clip filmed on Today shows on the therapist's child page with its exercise name
  - Needs: B25
- [x] **Azim** — `B52` Invite link for a therapist: the parent gets a link (not only a code) to send by Telegram; a therapist with a new number who opens it signs in straight into a therapist account (the server takes `inviteCode` at sign-in) and accepts in one step
  - Done when: a new number opens the link, signs in, and sees the child without typing a code
  - Needs: B26

### M5 — Assistant

*After this: a parent or therapist asks the assistant by text or by voice.*

**Server — in this order**

- [ ] **Azim** — `E1` Write 30 real parent questions in Uzbek Latin and Russian, each with the safe answer described
  - Done when: a therapist has read and corrected them
  - Needs: —
- [ ] **Azim** — `E2` Blind test of the low-cost model from at least 3 AI providers on those questions
  - Done when: a native speaker rated the answers without seeing the provider; the winner and its price are written in section 3
  - Needs: E1 (all providers through OpenRouter)
- [ ] **Azim** — `V5` Choose speech-to-text for Uzbek and Russian
  - Done when: a test with real parent voices is good enough to use; the choice is written in section 3
  - Needs: —
- [x] **Azim** — `A9.1` Tables for chats, messages and AI usage
  - Done when: the database change applies and rolls back
  - Needs: A2.1

**Website and content — in this order**

- [x] **Azim** — `B29` Assistant screen: emergency words (seizure, trouble breathing, a fall with a head injury, sudden strong pain) show **103** before anything else
  - Done when: tested in all 4 languages
  - Needs: —
- [x] **Azim** — `A9.2` Server: the AI provider behind one setting, with a fake one for tests; a daily message limit; the child's name and birth date are never sent
  - Done when: a Free family gets about 20 messages a day; a test proves requests contain no child name
  - Needs: A9.1, E2, G7
  - Decision (2026-10-19, Azim): build it now with the OpenRouter key in `apps/api/.env`. The model is the setting `AI_MODEL`, a placeholder (`google/gemini-2.5-flash`) until E2 picks one. G7 must still be answered before real families use it (F5)
- [x] **Azim** — `A9.3` Server: emergency words in 4 languages return **103** before any AI call; every answer is checked against the child's restrictions
  - Done when: tested in all 4 languages
  - Needs: A9.2
- [x] **Azim** — `A9.4` Server: store chats; the parent can delete them; a summary for the therapist
  - Done when: the therapist gets topics and warnings only, never the full chat
  - Needs: A9.2
- [x] **Azim** — `A9.5` Server: the weekly two-sentence summary and the plan explanation, written only from stored facts
  - Done when: a test proves the text contains no fact that was not given
  - Needs: A9.2, A5.3
- [x] **Azim** — `A9.6` Server: a monthly spending limit for AI
  - Done when: the assistant falls back to fixed answers when the limit is reached
  - Needs: A9.2
- [x] **Azim** — `A9.8` Research library: load the open research files, search them, and give the assistant only the matching passages with their source
  - Done when: an answer names the book or paper it came from; with no matching passage the assistant says it does not know
  - Needs: A9.2, Azim's research files (2026-10-19: Azim gives the files later)
  - Data set (Azim, 2026-10-22): the CEO's knowledge base `1_FlexiKeys_Knowledge_Base.md` (89 entries KB-…, sources
    S1–S61), kept outside the repo in `~/code/flexikeys-dataset/`, never committed. Its entries say "DRAFT: needs the
    physio's sign-off"; the therapist approved the package for now (2026-10-22)
  - Note: the server reads it from `RESEARCH_PATH` (a file or folder); production refuses a real AI without it, so
    putting the server live (A13.4) must copy the file to the server, outside git. Massage entries (FA7) and draft
    exercise cards are left out; entries tagged "not for parents" go to therapists only
- [x] **Azim** — `B30` Assistant knows the child's plan, finished tasks and restrictions
  - Done when: it never suggests a forbidden exercise
  - Needs: A9.3
- [x] **Azim** — `B31` Assistant in the therapist dashboard; summary of the parent's chats
  - Done when: the therapist never sees the full chat
  - Needs: A9.4
- [x] **Azim** — `A9.9` Server: a shared therapist asks the assistant about the child in their own chat (spec §6, §12); the assistant summary counts only the family's chats
  - Done when: a shared therapist gets an answer; another therapist gets 404; the therapist's questions are not in the family's summary
  - Needs: A9.4
- [ ] **Azim** — `A9.7` Server: speak a question and hear the answer
  - Done when: it works in 4 languages
  - Needs: A9.2, V5, V2
- [ ] **Azim** — `B32` Assistant voice: a microphone button and a "read aloud" button
  - Done when: it works in 4 languages in the browser
  - Needs: A9.7
- [x] **Azim** — `B33` Connect the assistant screens to the server
  - Done when: a real question gets a real answer in the browser
  - Needs: A9.5, A9.9, B29, B30, B31
- [x] **Azim** — `A4.6` AI chooses the plan inside the safe list (Azim's direction, 2026-10-20; waits for the founders, Q12). The rules first remove everything forbidden for this child or without approval; then AI builds the 4-week plan from **only two lists**: the exercise videos a physiotherapist approved (about 100) and FlexiKeys' own fixed, limited set of games (no therapist approval needed for games; Azim, 2026-10-20). AI picks the games by the child's condition too. It uses the parent's answers (daily time, condition, movement level, goals) and decides **only from Azim's research data set** (A9.8), never from the AI's own knowledge: the server finds the matching passages and gives the AI only those; every choice must cite one of them, and a choice with no source, or a source that was not given, is thrown away. Code checks the answer: every item on the approved lists and safe for this child, the daily time and the 4-week shape kept; otherwise, or when AI does not answer, the rules plan is used. The same answers keep the same plan until the next round (the AI's plan is stored)
  - Done when: a test proves a forbidden or unapproved item is never in a plan, whatever the AI answers; a test proves a choice without a source from the given passages is dropped; a plan names its research source for each choice; with the AI switched off the rules plan comes
  - Needs: Q12, A9.8 (built 2026-10-22 behind the `AI_PLAN` switch, off: turning it on is A4.7)
  - Note: the AI picks exercises from `engine.allowed_exercises` and games from the fixed set, each citing a research
    entry; the engine still lays out the days. Each pick's reason keeps its source (`plan_reasons.source`, migration
    0039; `reasons[].source` in GET /children/{id}/plan); "+ai" on the plan's engine version. A real try: 2 AI calls,
    about $0.002 a plan
- [ ] **Bekzod** — `A4.7` The AI builds every family's plan (Azim, 2026-10-25): `AI_PLAN=true` with `RESEARCH_PATH`
  becomes the normal setting, and the AI decides only from Azim's research papers and data set (A9.8). The rules
  still remove everything forbidden first (rule 2), and the rules plan is used only when the AI fails or does not
  answer. No step waits for a therapist (section 3, "Therapists approve videos only")
  - Done when: a new family's plan is the AI's choice, with a research source for each item; a test proves the
    rules plan comes only when the AI fails
  - Needs: G7 (may health data go to an AI company abroad), E2 (the model)
- [x] **Bekzod** — `A4.8` No plan waits for a therapist. Today a red-flag answer (`_hold` in
  `apps/api/app/modules/intake/bridge.py`) gives games only with "Some answers need a therapist's look first", and
  a family with no linked therapist stays there for good. Change it to:
  - Lost skill, recent Botox or surgery, seizures still happening, heart problem: games only, and the parent sees
    "Please see your doctor before starting exercises" (not "a therapist"). The next round (the monthly re-check)
    asks again and builds the full plan once the answer has changed
  - Down syndrome: an AI plan with its restrictions (no neck-bending, rolling or head-down), not "through the therapist"
  - Frequent pain with no place marked: an AI plan without hard exercise (`high_intensity`)
  - Autism only: stays games and My Voice (founders, 22 Oct), with no therapist wording
  - A linked therapist can still set restrictions and dates; their answer wins (rule 4)
  - Done when: no parent screen or message says a therapist must look at or approve the plan; a test for each case
    above gives the plan described
  - Needs: —
- [x] **Azim** — `B58` Show the AI's reasons and sources for each plan item to the therapist, and the simple explanation to the parent
  - Done when: a therapist sees why each exercise and game was chosen, and can still change anything (rule 4)
  - Needs: A4.6

### M6 — Find help, booking, Home Kit

*After this: a parent finds a clinic, books a visit and orders a kit.*

**Server — in this order**

- [x] **Azim** — `A10.1` Table of places; an admin adds and edits places
  - Done when: a place has every field the spec lists
  - Needs: A1.7
- [x] **Azim** — `A10.2` Search: free state centres first, then by distance; a parent reports wrong information
  - Done when: a price older than 6 months says "price not recently checked"; a report flags the place
  - Needs: A10.1
- [x] **Azim** — `A10.3` Clinic accounts and their free times
  - Done when: a clinic sees only its own data
  - Needs: A1.7
- [x] **Azim** — `A10.4` Booking, confirm and cancel, in person or online
  - Done when: the database makes a double booking impossible
  - Needs: A10.3
- [x] **Azim** — `A10.5` Reminders 1 day and 2 hours before a visit
  - Done when: the reminder jobs run on time in tests
  - Needs: A10.4, A5.2
- [x] **Azim** — `A10.6` Visit reminders stop going by SMS (G10): the job keeps finding due visits but sends nothing until the mobile app's notifications exist
  - Done when: a test sees no SMS for a visit tomorrow, and the job still marks the reminder as handled
  - Needs: G10
- [x] **Azim** — `A11.1` Home Kit products, orders and delivery status
  - Done when: an order goes from placed to delivered
  - Needs: A1.1, G3 (placeholders for now)
- [x] **Azim** — `A11.2` The allergy question (P17a) is checked before an order is accepted
  - Done when: an order is refused until the question is answered
  - Needs: A11.1

**Website and content — in this order**

- [x] **Azim** — `B34` Find help screen: pick a need, see places (free first, then by distance), report wrong information
  - Done when: "I'm not sure" suggests the child's doctor or a free state centre and never guesses
  - Needs: G2 (placeholders for now)
- [x] **Azim** — `B35` Booking screen: free times, book in person or online
  - Done when: a taken time cannot be chosen
  - Needs: G4 (placeholders for now)
- [x] **Azim** — `B36` Clinic dashboard: publish free times, confirm or cancel, add an online link
  - Done when: a clinic sees only its own bookings
  - Needs: G4 (placeholders for now)
- [x] **Azim** — `B37` Connect Find help, booking and the clinic dashboard to the server
  - Done when: a parent books a real free time in the browser and the clinic confirms it
  - Needs: A10.2, A10.5, B34, B35, B36
- [x] **Azim** — `B38` Home Kit order screen: allergy question, address, delivery or pickup
  - Done when: the order button stays off until the allergy question is answered
  - Needs: G3 (placeholders for now)
- [x] **Azim** — `B39` Connect the Home Kit order to the server
  - Done when: an order placed in the browser appears for the admin
  - Needs: A11.2, B38

### M7 — Launch

*After this: real families use it.*

**Server — in this order**

- [x] **Azim** — `A12.1` See and download everything stored about a child
  - Done when: the file contains all personal data of the child
  - Needs: A2.7
- [x] **Azim** — `A12.2` Delete a child or the whole account; the data is removed for good within 30 days
  - Done when: the data is gone from the database after the job runs
  - Needs: A12.1, A5.2
- [x] **Azim** — `A12.3` Delete any clip or chat; stop any share
  - Done when: each works at once
  - Needs: A8.3, A9.4
- [x] **Azim** — `A12.4` Deleting a therapist's account (by an admin): their answers about a child go with it today (therapist_answers cascades). Keep the restrictions (T6) and exclusions (T8) in use, so the child's plan never loses a safety rule
  - Done when: a deleted therapist's restriction still never appears in the plan
  - Needs: A12.2
- [x] **Azim** — `A13.1` Second sign-in step for admins
  - Done when: an admin cannot act with only a stolen SMS code
  - Needs: A1.7
- [ ] **Azim** — `A13.2` Connect a real SMS provider (Eskiz.uz, Q6)
  - Done when: a real phone receives a real code
  - Needs: Q6, Azim's go-ahead and the Eskiz key in apps/api/.env (not yet: demo only for now)
- [x] **Azim** — `A13.3` Production Docker files with HTTPS
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
- [x] **Azim** — `A13.7` `deploy/`: the website image is built without `FK_STORAGE_ORIGIN` (and the Dockerfile has no such build argument), so the browser's security policy blocks videos and voice notes from `files.<domain>`; also check the server's file links point at `files.<domain>`
  - Done when: with `deploy/compose.yaml` on this computer a voice note uploads and plays over HTTPS
  - Needs: —
- [x] **Azim** — `A13.8` Admin console addresses on `apps/api`: the list of users, the overview numbers (with service health), the audit log and the feature flags. The website's admin pages still ask the old backend's `GET /admin/users`, `/admin/overview`, `/admin/audit-logs`, `/admin/feature-flags`; `apps/api` answers 404 or 405
  - Done when: each answers an admin (with the second step) and refuses everyone else
  - Needs: A13.1
- [ ] **Azim** — `F3` Security check before launch
  - Done when: no serious finding is open
  - Needs: A13.4
- [ ] **Azim** — `F4` Load test: many children playing at once
  - Done when: the server stays fast at the pilot's expected size
  - Needs: A13.4

**Website and content — in this order**

- [x] **Azim** — `B40` "Everything we store about your child" in plain words; delete one video or one chat
  - Done when: each delete works at once on demo data
  - Needs: —
- [x] **Azim** — `B41` Connect seeing, downloading and deleting your data to the server
  - Done when: a parent downloads their child's data in the browser
  - Needs: A12.3, B40
- [x] **Azim** — `B42` Remove scores and percentages from every parent screen
  - Done when: no parent screen shows a score, a percentage or a comparison of children
  - Needs: —
- [x] **Azim** — `B53` Demo data: deleting a child and downloading its data skip the newer tables (daily tasks done, daily answers, tries, play check, skill levels, play time, paused days, feedback clips, therapists' answers and replies)
  - Done when: after deleting a demo child no row with its id is left, and the download holds every table that "Everything we store" counts
  - Needs: —
- [x] **Azim** — `B54` `apps/web/README.md`, "Live mode": it still describes the old backend (its repository, Google sign-in, SMTP, Mailpit, Payme/Click test keys). Rewrite it for `apps/api`
  - Done when: every step in that section works with `apps/api`
  - Needs: —
- [x] **Azim** — `B56` Connect the admin console's overview, users, audit log and feature flags to the server
  - Done when: in live mode an admin sees the real users and audit log in the browser
  - Needs: A13.8
- [x] **Azim** — `B43` New text for the public pages and the pricing page
  - Done when: they describe the new product, not the old 16 levels
  - Needs: G3 (placeholders for now)
- [ ] **Azim** — `B57` Privacy and terms pages: they still describe schools, teachers, emails and Payme/Click payments. Rewrite them for the new product with the final consent texts and the lawyer's answers
  - Done when: they match the consents the app asks for and say where the data is stored
  - Needs: G6, G7
- [ ] **Azim** — `B44` Native-speaker check of the Uzbek Latin and Russian text
  - Done when: a named person has signed off each language
  - Needs: —
- [x] **Azim** — `B45` Remove the hidden old features, or keep them hidden
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
  - Bought (2026-10-19): flexikeys.uz. Still to do: rent the server (Contabo, Q4) and point the domain's DNS at it
- [ ] **Azim** — `F2` Build and release the website for production
  - Done when: the website opens at the real address and talks to the real server
  - Needs: A13.4
- [ ] **Azim** — `F5` Pilot with real families in Tashkent
  - Done when: the spec's pilot numbers (section 17 of the spec) are being measured
  - Needs: F2, F3, Q4, G6, G7

---

### M8 — New parent questionnaire (Azim's priority, 2026-10-22)

*After this: a parent answers the CEO's 16 Oct questionnaire, and the plan, games and assistant still work from it.*
Source: `FlexiKeys Parent Intake Questionnaire.pdf` (174 parent questions, L1–L9 for the therapist, display rules
R1–R19, red flags). Same IDs as the CTO package (`dataset/cto/`, checked: all 183 match). Keep the question numbers:
the database fields never shift.

- [x] **Azim** — `IQ1` The questionnaire as data: every question, answer option, required mark, section and module, and the display rules R1–R19 and follow-ups written as rules the website and the server both read
  - Done when: a shared case file proves the website and the server show the same questions for at least 8 sample children (one-sided CP walking, CP GMFCS V, Down syndrome not sitting, autism only, DCD, delay, two diagnoses, under 4); every unclear rule is listed under the task for the therapist
  - Needs: —
  - For the therapist and the CEO (how IQ1 read the unclear points; each is one line to change in `questionnaire.json`):
    1. R5, autism only: C3–C6 and C12 are always asked; the rest of C and D open when C3–C6 are below the top step or E1 is stiff, floppy or changing ("a motor problem" is our reading)
    2. Two diagnoses: a question one diagnosis hides is still asked when another chosen diagnosis needs it
    3. "Walks" (CP7, CP13) = C6 with a walker or better; "stands" (DS4) = C5 with trunk support or better
    4. The rules' "Show" column only describes; questions are hidden only by "Hide" (so E5 is asked of everyone)
    5. C12 (lost a skill) is asked of every child, whatever the diagnosis
    6. DD1's milestone checklist is a temporary list until the physio gives the pictures per age band
    7. Drafts to check: seizure follow-ups (R17), the vision follow-up (R18), the budget ranges in I6, device sizes as one text (B11), day positions as one text (CP19), the body-map list of 12 parts
    8. F10 says "when something doesn't work out" instead of "fails"; A6 and A8 stay at sign-up; K1 is the baseline video
- [x] **Azim** — `IQ2` Server: save and check answers to the new questions (new kinds: number, body map, picture choice, milestone checklist, scale, time, file), health answers encrypted, "finished" by the new display rules; a round remembers which questionnaire it used, so old rounds stay readable
  - Done when: a round of the new questionnaire can be saved, continued and finished for each sample child; an old P-round still opens
  - Needs: IQ1
- [x] **Azim** — `IQ3` Bridge: turn new answers into what the plan, the skill model and the assistant already use (movement level, hand level, restrictions, goals, daily minutes, start levels), and add the questionnaire's red flags (lost skill, recent surgery or Botox, seizures still happening, choking, weak bones, shunt, pain, Down syndrome neck check, heart)
  - Done when: tests prove "not sure" and missing answers give the cautious choice, every red flag holds or removes what it says, and a plan is made from a new round
  - Needs: IQ2
  - For the therapist (how IQ3 reads the answers; `apps/api/app/modules/intake/bridge.py`):
    1. The questionnaire has no "a doctor said your child must not..." list (P14), so until a therapist sets restrictions (IQ6) every new-questionnaire plan leaves out jumping, tummy-lying, neck-bending and one-leg exercises
    2. Holds (no exercises, games only; the parent is told to see their doctor): lost a skill (C12), surgery or Botox in the last 6 months or with no date, seizures still happening, heart condition; autism only (package R21) is games and My Voice. Since A4.8, Down syndrome gets a plan with its restrictions and frequent pain with no place marked gets a plan without hard exercise
    3. Extra limits: Down syndrome neck not checked → no neck-bending or tummy-lying; weak bones, shunt or implant (or not answered) → no hard exercise; shunt or implant → no tummy-lying or neck-bending; one side weaker without a diagnosis → no leg-balance or hard exercise; pain or a broken bone in one place → that body area is left out; choking "sometimes" or more → no mouth exercises
    4. Without the GMFCS picture (DCD, delay...), the walking and sitting steps (C6, C3) give the movement level; 45+ minutes counts as 30; J9 goals: "Stand" → walk, "Use hands to eat" → eat and hands, "Play on tablet" → understand, "Less pain" has no exercise goal
- [x] **Azim** — `IQ4` Website: the questions screens for the new questionnaire (sections, modules, follow-ups, new answer kinds; pictures shown as text cards until IQ7)
  - Done when: each sample child's questions can be answered in the browser, saved, continued later and finished into a plan, in the demo and against the server
  - Needs: IQ1, IQ2, IQ3
  - Note: `/parent/children/new` asks the set the server hands out (`GET /intake/questionnaire`, from
    `INTAKE_QUESTIONNAIRE`; still `p41` until IQ8); the demo tries the new one with `?q=2026-10-16`. Live test:
    `e2e-live/questionnaire.e2e.ts` runs only against a server started with `INTAKE_QUESTIONNAIRE=2026-10-16`.
- [x] **Azim** — `IQ5` Uzbek (Latin) and Russian text for every new question and option, marked for the native-speaker check (B44)
  - Done when: no new question shows English in another language
  - Needs: IQ1
  - Note: draft text, `text_status` in questionnaire.json says so. For the B44
    check, words the translators were unsure of: DCD1–DCD6 options say "harder" not "worse" but the questions still
    compare with other children (rule 1, see DCD1's note); device names (stander / standing frame, gait trainer,
    rollator, AFO); "hips" on the body maps; AU7 "meltdowns" (uz); I1 occupational therapy ("Эрготерапия"); "therapist"
    is «специалист» in Russian («терапевт» is a GP); G7 options are in the child's voice in Uzbek; I6 amounts use
    "500 000" and soʻm/сум; L5 keeps the source's "А–Р"
- [x] **Azim** — `IQ6` Therapist assessment L1–L9 in the therapist dashboard; L2 overrides the parent's movement level and L9 the restrictions (rule 4)
  - Done when: a therapist's L2 and L9 change the plan; scores (L3 percentages) are never shown to the parent (rule 1)
  - Needs: IQ3
  - Note: L2 is the form's T2 (GMFCS) and L9 is T6 (restrictions, now with "no hard exercise" for L9's maximum
    effort); the rest of section L is the form's "L" answer, therapists only. A T6 answer ends the questionnaire's
    red-flag hold and its restrictions are the ones used. L9's massage areas are only stored: the plan has no
    massage yet (Q: founders' decision on massage)
- [ ] **Azim** — `IQ7` Pictures for C10 (GMFCS), D1 (MACS/Mini-MACS), G2 (CFCS), C13, CP2 and the body maps
  - Done when: each picture question shows drawings approved by the physio
  - Needs: Q13 (permissions), drawings from the physio and a designer
- [x] **Azim** — `IQ8` Switch: new parents get the new questionnaire; consents (section K), monthly re-check and baseline videos follow the CEO's answers
  - Done when: the old P1–P41 screens are no longer shown to new families
  - Needs: IQ4, IQ5, IQ6, the CEO's answers to the review's 9 points
  - Note (2026-10-22): `INTAKE_QUESTIONNAIRE` now defaults to `2026-10-16`; a round started on P1–P41 keeps it, and
    the next round (re-check) asks the new set with the answers it still has. The older tests pin `p41` (server
    tests' conftest, the demo tests' build, the live CI server). Section K moved to IQ9; the monthly re-check is FA4;
    the five consents of section K go with the lawyer's answers (B57)
- [ ] **Azim** — `IQ9` Section K baseline videos: the 11 video tasks with the recording rules, only the tasks the child
  can do (from C and D), saved as movement clips with the movement-video consent; task 11 (tapping targets) is
  recorded by the app
  - Done when: a parent films the tasks the questions say the child can do, and the therapist sees them
  - Needs: the physio's rule for which task shows after which C and D answers; Q14 (what the monthly re-check asks)

### M9 — Founders' answers of 22 Oct (Azim, 2026-10-22)

- [ ] **Azim** — `FA1` Speech delay in the questionnaire's diagnosis list (B1), with its own plan rule
  - Done when: a parent can pick it and the plan follows the founders' rule for it
  - Needs: Q14 (which plan a child with only speech delay gets)
- [x] **Bekzod** — `FA2` Ages 2–18 all get the plan made from their answers and game results; age alone never gives the limited plan (founders, 30 Oct 2026)
  - Done when: a 2-year-old and an 18-year-old with the same answers get a normal plan and are not put on the therapist's list because of age
  - Needs: —
  - Note (30 Oct 2026): no age check gave a smaller plan or a therapist flag; age only picks age-fitting exercises (bands 2-4, 5-8, 9-12, 13-20, 26-33 of the 33 each). `tests/test_plan_ages.py` and `questionnaireBridge.test.ts` prove it
- [x] **Azim** — `FA3` Remove Uzbek Cyrillic: three app languages (Uzbek Latin, Russian, English); families on Cyrillic move to Uzbek Latin
  - Done when: no screen offers Cyrillic, and a saved Cyrillic choice opens in Uzbek Latin
  - Note: migration 0038 moves accounts and children on `uz_cyrl` to `uz`; the server refuses `uz_cyrl` (422); the
    transliterator (lib/cyrillic.ts) is gone
- [ ] **Azim** — `FA4` 12-week plan in 3 steps of 4 weeks, a short re-check with a video every month that builds the next step
  - Done when: a plan shows 3 steps; the monthly re-check opens the next step
  - Needs: Q14 (Free's share of the 12 weeks; what the re-check asks)
- [x] **Azim** — `FA5` ~~The therapist approves the plan before the parent sees it~~
  - DROPPED (Azim, 2026-10-25): therapists approve videos only, never a plan (section 3). See A4.7 and A4.8
- [ ] **Azim** — `FA6` Who can start: delay or not sure gets the limited plan (not only when one side is weaker)
  - Done when: each launch group gets its plan: CP and DCD full; delay or not sure limited; autism games and My Voice; Down syndrome an AI plan with its restrictions (A4.8, not through the therapist)
  - Needs: Q14 (what the limited plan is)
- [x] **Azim** — `FA7` Home massage out of the first release: L9's massage areas stay stored, no massage anywhere a parent sees
  - Done when: no plan item or assistant answer suggests home massage
  - Note: the plan has no massage exercise; the assistant never gets the knowledge base's massage section or its
    massage rule (KB-MAS-*, KB-CONF-05) and is told not to suggest it. The questionnaire's touch and massage questions
    (AU8, E8, and "Massage" as a therapy now in I1) stay as the CEO's set has them; they only feed the later massage
    feature. L9's massage areas are only stored
- [x] **Azim** — `FA9` The assistant's instructions say "the child has cerebral palsy"; with DCD, delay, autism and Down
  syndrome children (founders, 2026-10-22) they should name the child's own condition from the answers
  - Done when: a DCD child's chat does not call the child's condition cerebral palsy
- [ ] **Azim** — `FA8` Home Kit optional: a family without the kit gets exercises with household things
  - Done when: a plan for a family without the kit has no kit-only tool
  - BLOCKED (2026-10-22): 21 of the 33 exercises need a kit tool, so without the kit a plan has only the other 12 until
    the household exercise library exists (the CEO's 109 activity cards need videos, C-tasks). Waiting for Azim: switch
    now (smaller plans for families without a kit) or after the household library
- [ ] **Azim** — `Q14` Ask the founders 4 follow-ups to their answers of 22 Oct
  - 1. ~~"Therapist approval is Pro only" and "the therapist approves every plan before the parent sees it": which one?~~ Answered by Azim (2026-10-25): no therapist approves a plan; every family sees its AI plan straight away. Tell the founders
  - 2. What is the "limited plan" (Free, delay or not sure)? For example: shorter, lying and sitting only, no balance and no hard exercise
  - 3. Which plan does a child with only speech delay get: games and My Voice, or the limited plan?
  - 4. How much of the 12 weeks does Free get (now the first week of 4), and what does the monthly re-check ask?

### Parent review fixes (30 Oct 2026, Bekzod)

*Bekzod filled in the sign-up and the parent questionnaire as a parent (Russian and English). Every point has a
decision; the source is "FlexiKeys — parent questionnaire fixes" (30 Oct 2026). Order: B59, B60, B61, B62, B63, then FA2.*

- [x] **Bekzod** — `B59` Sign-up: city and district names in the app language, and the age line "for children aged 2 to 18" on the sign-up screen and step A (items 1, 5)
  - Done when: in Russian the city and district lists are in Russian, in English in English; the stored value is unchanged; the sign-up screen and step A say "2 to 18"
  - Needs: —
- [x] **Bekzod** — `B60` Child basics: date of birth as Day / Month / Year, height and weight required, no "Not sure" on family facts (items 2, 3, 4, 5, 6)
  - Done when: date is Day / Month / Year with a hint; year 0001, future dates and ages outside 2–18 are refused on the website and the server; height and weight are required with the new ranges; A3, A4, A4_kg, A5, A7, A9 show no "Not sure"
  - Needs: B59
- [x] **Bekzod** — `B61` Diagnosis and body parts: B1 without "Not sure", B3_parts replaces B3, C2_side deleted, ages in months checked against the child's age (items 7, 8, 13)
  - Done when: B1 has no "Not sure"; B3_parts replaces B3 and its pattern feeds every rule B3 fed; C2_side is gone; an age at diagnosis (or DD2/DD2_walk) larger than the child's age shows the message and is refused by the server; old saved answers still load
  - Needs: B60
- [x] **Bekzod** — `B62` Skill questions: wording and options (items 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25)
  - Done when: every text of the review's section 5 is in place in en and ru with a uz draft; hints show on the step questions; C1, C4, C7, D12 changes work with the rules and the bridge; the cases files cover the new ids
  - Needs: B61
- [x] **Bekzod** — `B63` Optional answers: clear by tapping again; "Not sure" on C14, C17, C19 (item 18)
  - Done when: tapping a chosen optional answer clears it, and the three questions show "Not sure"
  - Needs: B62
- [ ] **Bekzod** — `B64` C1 (head control) "Not yet" or "Only for a short time" changes the child's setup: a tablet stand at eye level and supported seating (Home Kit and settings), and a flag for the therapist that switch access may be needed (review item 14, part 3)
  - Done when: a child with C1 "Not yet" or "Only for a short time" gets the tablet stand and seating advice in the Home Kit and settings, and appears on the therapist's list with "switch access may be needed"
  - Needs: B62
  - Note (B62): nothing yet turns questionnaire answers into device or seating settings (`feeds: ["S"]` is only a label), so B62 did the wording and the show rule only, as the review said
- [ ] **Bekzod** — `B65` A cleared optional answer is cleared on the server too. Since B63 a parent clears an optional answer by tapping it again, but the website sends only given answers, so an answer saved earlier comes back after a reload (`Questionnaire.tsx` save, the "ponytail" comment)
  - Done when: an optional answer saved, then cleared and saved again, is gone after a reload, in the demo and against the server (a "clear" in the save request; null stays "Not sure")
  - Needs: B63

### Hosting (31 Oct 2026)

- [x] **Bekzod** — Website demo on Vercel (mock mode, no server)
  - Done when: the site opens at the `.vercel.app` address, sign-up and the questionnaire work in ru and en at
    phone width, and `apps/web/DEPLOY-VERCEL.md` says how to redeploy.
  - Needs: —

## 6. Ask and collect

These are not programming. The named developer asks the right person and writes the answer **in this file**
(in section 3 for a decision). Do them early: each one unblocks the tasks on its "Needed for" line.

**Azim**

- [x] **Azim** — `Q1` Send the founders the three differences from the spec (section 3) and get their answer in writing
  - Needed for: A6.1, C2
- [x] **Azim** — `Q2` Ask the founders: do the child games and My Voice get server support in the first version? Recommended: yes
  - Needed for: A6.3
- [ ] **Azim** — `Q3` Ask the founders: who is the reviewing physiotherapist, and how many videos a week can they review?
  - Found; still needed: their name, phone number (for their account) and videos per week
  - For now (2026-10-19): a placeholder reviewer (the demo's +998 90 000 00 03 "Rustam Yusupov"); the real person replaces it later
  - Needed for: C5
- [x] **Azim** — `Q4` Ask the founders and the lawyer: hosting at Contabo, or on a server in Uzbekistan?
  - Answer: Contabo. The lawyer's check is G7, before the pilot
  - Needed for: A13.3, F1, F5
- [x] **Azim** — `Q5` Ask the founders: reminders by browser notification, Telegram or SMS? Recommended: Telegram first
  - Needed for: A5.6
- [x] **Azim** — `Q7` Ask the founders: delete the old features (teachers, classes, email sign-in), or keep them hidden?
  - Needed for: B45
- [x] **Azim** — `Q8` Ask the founders: which Telegram payment flow, and when Payme and Click?
  - Needed for: real payments after the pilot
- [x] **Azim** — `Q9` Ask the founders: when does the mobile app start? Recommended: after M2
  - Needed for: planning only
- [ ] **Azim** — `Q11` Ask the founders and the lawyer (with G7): does the assistant need its own consent before a family's questions go to an AI company abroad? The spec's consents (§4) have none, so the server has none; the website's "AI help" switch only works in the demo
  - Needed for: F5
- [ ] **Azim** — `Q13` Ask CanChild (GMFCS, CFCS) and the MACS / Mini-MACS owners for permission to show picture versions in the app; ask the centre about GMFM, SATCo and the А–Р motor skills sheet (the questionnaire's own open items)
  - Needed for: IQ7
- [x] **Azim** — `Q12` Ask the founders: may AI choose each child's plan, only from the approved exercise videos and FlexiKeys' fixed set of games, after the rules removed everything unsafe (A4.6)? The spec (§13) says the plan comes from fixed rules, "not from an AI guessing". Azim's direction (2026-10-20): yes. Write the answer in section 3
  - Answer (2026-10-22, founders): yes, the AI chooses, only inside the safe list the rules allow
  - Needed for: A4.6
- [x] **Azim** — `Q10` Ask Shoxjahon once whether the `web-backend` server branch exists anywhere. If it is not found in a few days, stop looking
  - Answer (2026-10-19): dropped. We don't look for the old branch
  - Needed for: nothing; it could save work
- [ ] **Azim** — `G1` Get the final exercise list, approved by a physiotherapist: name, steps and safety tags for each exercise
  - Needed for: C2
- [ ] **Azim** — `G2` Get about 40 checked places in Tashkent: name, type, district, map link, contacts, languages, ages, works with CP, price range, date checked
  - For now (2026-10-19, Azim): build with placeholder data, clearly marked as test data and kept off production; the real data replaces it
  - Needed for: B34
- [ ] **Azim** — `G3` Get the Pro price, the exact Free contents, the Home Kit price and the exact items in the box
  - For now (2026-10-19, Azim): build with placeholder data, clearly marked as test data and kept off production; the real data replaces it
  - Needed for: A7.2, A11.1, B21, B38, B43
- [ ] **Azim** — `G4` Get the partner clinics and their free times
  - For now (2026-10-19, Azim): build with placeholder data, clearly marked as test data and kept off production; the real data replaces it
  - Needed for: B35, B36
- [ ] **Azim** — `G5` Get the game catalogue (3 → 20 games) and the onboarding assessment document, both named as sources in the spec
  - Game catalogue received (Azim, 2026-10-22): the CEO's `4_FlexiKeys_Game_Library.html` (23 games + My Voice), kept
    outside the repo in `~/code/flexikeys-docs/cto-package/`. Still to get: the onboarding assessment document
  - Needed for: B16
- [x] **Azim** — `G8` Decide: does the parent's own recorded voice on a My Voice card need its own consent? The website asks for a "voice recording" consent; the new server has no such consent yet, so in live mode cards have photos but no recorded voice
  - Answer (2026-10-19): yes, its own consent (the website's "voice recording" consent). Work: A8.7
  - Needed for: recorded voices on My Voice cards in live mode
- [x] **Azim** — `G9` Decide with the founders (spec §6 PROPOSAL): does an admin check each therapist's diploma by hand before their first share is active? And should a phone invite send an SMS to the therapist? Now the share works once the therapist accepts, and the parent passes the invite on by Telegram or by telling the therapist
  - Answer (2026-10-19): no diploma check for the pilot. Yes, a phone invite sends the therapist an SMS with the link. Work: A8.8
  - Needed for: a diploma check before a share, and invite SMS
- [x] **Azim** — `G10` Decide: visit reminders (1 day and 2 hours before) go by SMS now (simulated until Q6). Keep SMS, or move them to Telegram or the mobile app with the other reminders (Q5)? Each real SMS costs money
  - Answer (2026-10-19): the mobile app, later, with the other reminders (Q5). Work: A10.6
  - Needed for: real visit reminders
- [ ] **Azim** — `G6` Get the final consent texts in 4 languages. They must say that try records are kept on the server for 90 days
  - Needed for: F5
- [ ] **Azim** — `G7` Get the lawyer's answers: may children's health data be stored abroad, and may data be sent to AI and voice companies abroad?
  - Needed for: A9.2, F5

- [x] **Azim** — `Q6` Compare SMS providers (Eskiz.uz and others): price and how to connect
  - Answer (2026-10-19): Eskiz.uz. Not connected yet: the demo (code on screen) is enough for now
  - Needed for: A13.2
  - For now: sign-in stays simulated (the code shows on screen) until launch

---

## 7. Accounts

One owner for each. The owner keeps the password and the keys. Nothing from this table goes into git or chat.

| Account | Owner |
|---|---|
| GitHub repository | Azim |
| Test server | Azim |
| Production hosting | Azim (Contabo) |
| Domain name | Azim |
| Higgsfield | Azim |
| AI provider key | Azim (OpenRouter) |
| Voice provider key | Azim (ElevenLabs) |
| SMS provider | Azim |
