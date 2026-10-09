# FlexiKeys Web — Product Requirements Document (PRD)

> **Superseded where they disagree** by the founders' product spec of 6 October 2026 (`docs/product-spec-2026-10-06.pdf`): phone + SMS sign-in, parent intake, exercise roadmap with physio-approved videos, Home Kit, booking, 24/7 assistant, four app languages.

| | |
|---|---|
| **Document** | Web migration PRD — v1.0 |
| **Date** | 2026-09-28 |
| **Owner** | Shoxjahon (product + engineering) |
| **Status** | Draft for approval |
| **Audience** | The owner (learning backend while building), future developers, AI coding agents |
| **Source of truth for** | Everything about building the FlexiKeys web application and the backend changes it requires |

> **How to read this document.** Sections 1–7 describe *what exists today* (based on a full code analysis of this repository on 2026-09-28). Sections 8–31 describe *what we will build*. Sections 32–40 describe *how and in what order*. Words in **bold** the first time they appear are explained in **Appendix A — Backend 101 glossary**. If you are new to backend development, read Appendix A first, then Section 38–39 (architecture), then the roadmap (Section 33).
>
> **Priority tags used throughout:** `MUST` = required for the 3‑month launch, `SHOULD` = planned for launch but first to be cut if the schedule slips, `LATER` = explicitly after launch.
>
> **Decisions recorded from the owner's answers (2026-09-28):**
>
> | Topic | Decision |
> |---|---|
> | Web frontend | **Rebuild in Next.js / React (TypeScript)** |
> | Mobile | **Keep the Flutter app for iOS/Android**, sharing the same backend |
> | Users | Children at home, parents, teachers/schools, therapists/specialists |
> | Launch scope | **Full vision** (16 levels, adaptive engine, teacher, therapist, rewards, admin, AI, payments) |
> | Backend | **Keep FastAPI**; one PostgreSQL database |
> | Data location | **Hybrid from day one** — all personal data on servers physically in Uzbekistan (Uzbek personal‑data law); only non‑personal static media may use a global CDN |
> | Consequence | **Supabase is removed** (it has no Uzbek region). Auth is served by the FastAPI backend itself |
> | Login | Email + password, Google |
> | Child start | Parent logs in → picks child; **and** class code at school |
> | Countries | Uzbekistan |
> | Scale (12 months) | 1,000–10,000 children |
> | Budget | $25–$100 / month at launch |
> | Hosting | Managed where possible, but constrained by data law → Uzbek cloud/VPS for everything personal |
> | AI | Parent assistant, AAC sentence help, **new** teacher AI helper, **new** AI‑generated reports |
> | Voice | Pre‑generated Azure neural audio served from storage/CDN; live Azure TTS only for AAC free sentences |
> | Business | Family subscription via **Payme** and **Click** |
> | Therapists | Like teachers across many families; parent approves each link |
> | Offline | **Online only** (friendly "waiting for internet" state) |
> | Design | **New web redesign** keeping brand colors + cloud mascot |
> | Team / time | Owner + AI agents, **~3 months** (see Risk R1 — this is the single largest risk) |

---

## Table of contents

1. Product Overview · 2. Product Goals · 3. Target Users · 4. Existing Product Analysis · 5. Current Technology Stack · 6. Current Architecture · 7. Existing Features · 8. Web Version Requirements · 9. Functional Requirements (per feature) · 10. Non‑Functional Requirements · 11. Frontend Requirements · 12. Backend Requirements · 13. Database Requirements · 14. API Requirements · 15. Authentication & Authorization · 16. AI/ML Requirements · 17. User Roles & Permissions · 18. Admin / Parent / Child / Teacher / Therapist functionality · 19. Security · 20. Privacy · 21. Performance · 22. Scalability · 23. Responsive Design · 24. Browser Compatibility · 25. File/Image/Media Handling · 26. Error Handling · 27. Logging & Monitoring · 28. Testing Strategy · 29. Deployment Strategy · 30. Hosting · 31. Environment Configuration · 32. Development Phases · 33. Migration Roadmap · 34. Technical Risks · 35. Open Questions · 36. Acceptance Criteria · 37. Recommended Folder Structure · 38. Web Architecture · 39. Backend Architecture · 40. Step‑by‑step Implementation Plan · Appendix A Backend 101 · Appendix B Current endpoint inventory · Appendix C Current table inventory

---

## 1. Product Overview

FlexiKeys is an adaptive learning platform that teaches children aged 3–10 typing, early literacy, numeracy, fine‑motor skills and digital interaction. It is designed first for children with cerebral palsy and other motor difficulties and must work equally well for neurotypical children. It includes an AAC ("My Voice") module — a picture‑card communication tool that speaks sentences aloud for children who cannot yet speak or type fluently.

**The adaptive engine is the product.** It watches *how* a child interacts (accuracy, speed, hesitation, where their finger lands relative to a key, accidental double taps, fatigue) and silently adjusts the interface (bigger keys, more spacing, longer press‑to‑confirm time, more or fewer hints, repetition of weak items, break suggestions). Adaptation is invisible to the child and explained to parents in plain language.

**This PRD** covers turning FlexiKeys into a full web application (Next.js) for children, parents, teachers, therapists and admins, while the existing Flutter mobile app continues to exist on the same backend.

**Non‑negotiable product rules** (carried over unchanged from `CLAUDE.md`; every requirement in this PRD is subordinate to them):

1. Never stigmatize — no "disability mode"; adaptation is invisible to the child.
2. No failures — no red X, no error buzzers, no "wrong!" copy.
3. Effort‑based praise only ("Great effort", "You improved", "Take your time").
4. Mastery‑based progression — never by time or payment.
5. Never pay‑to‑win — rewards (coins, stars, cosmetics) are only earned through play. **A subscription may gate access to the product, never rewards or progression speed.**
6. Parents never configure adaptation — they only observe it.
7. AI gives educational guidance only and always discloses it is not medical advice.
8. Child data privacy is sacred — minimal PII, no third‑party analytics/ads in the child experience, pseudonymized telemetry.

---

## 2. Product Goals

### 2.1 Business goals
| ID | Goal | Measure (12 months) |
|---|---|---|
| G1 | Launch a production web app usable on laptops, desktops, tablets and Chromebooks | Public launch at `flexikeys.uz` (domain TBC) |
| G2 | Reach 1,000–10,000 active children | Monthly active children (MAC) |
| G3 | Sustainable revenue via family subscriptions (Payme, Click) | Paying families, churn |
| G4 | Adoption by schools and therapists | Active classes, active therapist links |
| G5 | Legal compliance in Uzbekistan from day one | All personal data stored in Uzbekistan; registered in the State register of personal‑data databases (see §20) |

### 2.2 Learning / product goals
| ID | Goal | Measure |
|---|---|---|
| L1 | Children make measurable progress | Median mastery gain (BKT P(known)) per skill per week |
| L2 | Adaptation improves accessibility | Accidental‑tap rate and hesitation decrease over first 4 weeks for children whose profiles adapted |
| L3 | Parents understand what changed and why | ≥ 80% of adaptation changes rendered with a plain‑language explanation in all 3 languages |
| L4 | Children stay comfortable | Session break suggestions shown when fatigue rises; no session > 20 min without a break prompt |

### 2.3 Engineering goals
| ID | Goal |
|---|---|
| E1 | **One backend, one database** for web and mobile (today there are two databases: Supabase + FastAPI Postgres) |
| E2 | **One content source** (curriculum JSON) for web and mobile (today, game content is hardcoded in Dart) |
| E3 | All backend security defects found in the 2026‑09‑28 review are fixed before any real user data is stored |
| E4 | CI is green: lint, types, tests for backend and web on every pull request |
| E5 | The owner understands and can operate the backend (deploy, migrate, back up, restore, read logs) |

### 2.4 Non‑goals (for this PRD)
- Full offline play on the web (decision: online only).
- Rewriting the mobile app in React Native.
- Native desktop apps.
- Free‑form AI generation shown to children (mascot copy stays curated).
- Parent control over adaptation parameters.

---

## 3. Target Users

| Persona | Description | Main devices | Key needs |
|---|---|---|---|
| **Child (3–10)** | Pre‑reader to early reader; some have CP / motor difficulties (limited fine motor control, tremor, slow or imprecise touches), some neurotypical | Tablet in browser, touchscreen laptop, laptop/desktop with mouse or physical keyboard, school Chromebook | Very large targets, calm visuals, audio for everything, no failure, short sessions, works with touch, mouse and physical keyboard |
| **Parent / guardian** | Creates account, adds children, gives consent, pays subscription, watches progress | Phone browser, laptop | Simple setup, clear progress, understand adaptations, AI guidance, AAC card management, privacy controls |
| **Teacher** | Runs a class at a kindergarten/school/inclusive class | Laptop, classroom tablets, projector | Create class, get class code/QR, children log in without email, assignments, class analytics, AI helper |
| **Therapist / specialist** | Speech therapist, occupational therapist, defectologist working with several families | Laptop, tablet | Linked (by parent approval) to several children across families; see progress + adaptation log + AAC usage; notes and goals; cannot change adaptation |
| **Admin (FlexiKeys staff)** | Owner / staff | Laptop | Manage users, content versions, feature flags, audit logs, subscriptions, support |

**Languages:** UI in English, Uzbek (Latin), Russian. Learning language chosen per child (en/uz/ru), independent of UI language. AAC speaks in the UI language (see §9.11).

---

## 4. Existing Product Analysis

This section is the result of reading the whole repository. It is intentionally candid: the web plan depends on knowing what is real, what is half‑built and what is broken.

### 4.1 Repository reality vs. documentation
| Documentation says | Reality |
|---|---|
| Flutter app lives in `app/` | Flutter app lives at the **repository root** (`lib/`, `android/`, `ios/`, `web/`, `pubspec.yaml`) |
| go_router for navigation | `lib/core/router.dart` builds a GoRouter, but **`main.dart` uses `MaterialApp.routes` (named routes)**; the GoRouter is unused except by the dev gallery |
| 16 curriculum levels in `shared/curriculum/` | JSON for 16 levels exists and the backend can import it, but **the app does not use it**. Playable content is **hardcoded in Dart** under `lib/data/` |
| Rive mascot | Mascot is drawn with CustomPaint (ADR 005), not Rive |
| Adaptive keyboard drives lessons | `LessonPlayerScreen` + `FkKeyboard` exist but are **not reachable from any navigation path** |
| JWT auth with Google/Apple in backend | Backend auth endpoints exist, but **parent auth was moved to Supabase**; backend now only verifies Supabase tokens. The old endpoints still exist and issue tokens nothing accepts |

### 4.2 What is solid and reusable (keep)
- **Backend domain logic**: adaptive engine (EWMA metrics, BKT mastery, SM‑2 spaced repetition, bounded policy, audit log), AAC service (events, AI sentence composition, insights, stats, Azure TTS), AI service abstraction (provider interface + Anthropic + stub), parent summary/export/delete, rewards, notifications, teacher basics, admin basics, PDF/weekly report workers.
- **Database schema** (31 tables, Alembic migrations) — normalized, sensible.
- **Local auth code** in `modules/auth` (Argon2id hashing, access+refresh JWT, refresh‑token rotation storage, Google/Apple ID‑token verification via JWKS, password reset, email verification) — this becomes the auth system again now that Supabase is removed.
- **Curriculum JSON + schema** (`shared/curriculum/*.json`, `schema.json`) and AAC card JSON (`shared/aac/`), pre‑generated audio pipeline (`tools/generate_aac_audio.py`, `tools/generate_level_audio.py`, `tools/tts_voices.py`).
- **Design direction** (palette, radii, typography, touch‑target rules), l10n strings in 3 languages (`lib/l10n/*.arb`, ~430 keys each) — reusable as a source for web translations.
- **Product knowledge docs**: `docs/FLEXIKEYS_DOMAIN_KNOWLEDGE.md`, `docs/pii-inventory.md`, `docs/asvs_auth_checklist.md`, `docs/keyboard_geometry_report.md`, AAC phase docs.

### 4.3 What is broken or risky today (must fix — from the 2026‑09‑28 review)
| # | Problem | Where | Severity |
|---|---|---|---|
| B1 | `/progress/skills`, `/timeseries`, `/adaptations` return **any child's** data to any logged‑in user (no ownership check) | `backend/src/flexikeys/modules/progress/router.py` | Critical |
| B2 | `PATCH /sessions/{id}` and `POST /sessions/{id}/events` don't check the session belongs to the child token → one child can poison another's adaptive profile | `modules/sessions/router.py` | Critical |
| B3 | `/rewards/earn` accepts any client‑supplied coin amount | `modules/rewards/schemas.py` | High (breaks rule 5) |
| B4 | `/teacher/classes/join` enrolls any `child_id` without checking parenthood | `modules/teacher/router.py` | High |
| B5 | Adaptive policy hysteresis is a **ratchet**: hints/key size never decrease after one increase; dwell/spacing/global scale have no decrease rule at all | `modules/adaptive/policy.py:152` | High (core product quality) |
| B6 | Child created in Supabase then backend with no rollback; consent recorded after PII stored | `lib/features/auth/data/children_repository.dart` | Medium |
| B7 | Supabase user mirroring can 500 on races/email collisions; role always `parent` | `core/deps.py`, `modules/users/repository.py` | Medium |
| B8 | Backend CI red: ruff 227 errors, mypy 54, 34 test failures from `asyncio.get_event_loop()` with pytest‑asyncio 1.x | `backend/tests/test_teacher*.py` | Medium |
| B9 | `backend/.venv` (5,258 files) committed to git | repo root | Low |
| B10 | **Flutter web build fails** (`drift`/`sqlite3` → `dart:ffi`; 7 files import `dart:io`) | `lib/services/local_db`, AAC | Info (web will be Next.js; relevant only if Flutter web is ever wanted) |
| B11 | Letter/word audio uses the **unofficial Google Translate TTS endpoint** — against Google ToS, sends child content to Google, blocked by CORS in browsers | `lib/services/tts_service.dart` | High for web |
| B12 | Some child‑facing strings hardcoded (English/Uzbek) | `child_picker_screen.dart`, `cloud_shop_screen.dart`, `shapes_screen.dart:494` | Low |
| B13 | Background workers exist as functions, but there is **no scheduler / queue runner** (no ARQ/Celery worker process, no cron) | `backend/src/flexikeys/workers/` | Medium |
| B14 | Supabase tables (`children`, `child_task_progress`) have **no schema/RLS in the repo** | — | Medium (goes away when Supabase is removed) |

---

## 5. Current Technology Stack

| Layer | Current technology | Notes |
|---|---|---|
| Mobile/desktop app | Flutter 3, Dart 3 | Android, iOS, macOS, Windows, Linux folders exist; web folder exists but build fails |
| App state | Mix: static singletons + `ValueNotifier` (UserService, TtsService…), Riverpod providers in newer features | Legacy gameplay screens use `shared_preferences` directly |
| App navigation | `MaterialApp.routes` named routes | go_router configured but unused |
| App local storage | `shared_preferences` (profile, stars, owned items, completed levels, settings), `flutter_secure_storage` (tokens), `drift` SQLite (AAC events queue) | |
| App HTTP | `http` package via `ApiClient` (`lib/core/network/api_client.dart`) | Handles parent token vs child‑session token |
| Auth (current) | **Supabase Auth** (`supabase_flutter`) for parents | Project URL + publishable key in `supabase_config.dart` |
| Remote data (current) | Supabase tables `children`, `child_task_progress` **and** FastAPI Postgres | Two sources of truth |
| Audio | `audioplayers`; Google Translate TTS (unofficial); pre‑generated Azure MP3s for AAC (uz only on disk) and levels | `record` package for parent‑recorded AAC custom card audio |
| Charts | `fl_chart` | Parent progress |
| Backend | FastAPI (Python 3.12), SQLAlchemy 2 async, Alembic, Pydantic v2, structlog | 16 modules |
| Database | PostgreSQL 16 | 31 tables, 5 migrations |
| Cache/queue | Redis 7 | Rate limits, idempotency keys; no queue worker running |
| Object storage | MinIO (S3‑compatible) in docker‑compose | `/media/upload` admin endpoint |
| AI | Anthropic Messages API via `services/ai_service.py` (default model string `claude-sonnet-4-6`), stub fallback | Parent assistant + AAC |
| TTS | Azure Speech (neural) for AAC `/aac/tts` and offline generation scripts | |
| CI | GitHub Actions (`.github/workflows/ci.yml`, `release.yml`) | Backend job currently failing |
| Infra | `infra/docker-compose.yml` (postgres, redis, minio, backend) | No production deployment config |
| Marketing site | Static `flexikeys-website 6/index.html` (git submodule) | |

---

## 6. Current Architecture

```
                         ┌───────────────────────────── Supabase (hosted, outside Uzbekistan) ─┐
                         │  Auth (parents)      tables: children, child_task_progress          │
                         └───────────▲───────────────────────────▲────────────────────────────┘
                                     │ sign in / JWT            │ direct table reads/writes
                                     │                          │ (children list/create, progress sync)
┌────────────────────────────────────┴──────────────────────────┴───────────────┐
│ Flutter app (phone/tablet)                                                     │
│  • Local truth: shared_preferences (stars, levels, shop), drift (AAC queue)    │
│  • Games content hardcoded in lib/data                                          │
│  • Letter audio: Google Translate TTS (unofficial)                              │
└───────────────┬──────────────────────────────────────────────▲────────────────┘
                │ Bearer <Supabase JWT>  (parent calls)        │ JSON
                │ Bearer <child_session JWT> (child calls)     │
                ▼                                              │
┌──────────────────────────────── FastAPI backend ───────────────────────────────┐
│ core/deps.get_current_user → verifies Supabase JWT, lazily creates users row   │
│ POST /children/{id}/session → issues child_session JWT (signed by backend key) │
│ modules: children, sessions(events), adaptive, progress, rewards, parent,      │
│          teacher, admin, ai_assistant, aac, notifications, media, curriculum   │
│ in‑process BackgroundTasks → adaptive metric pipeline                          │
└───────┬─────────────────┬────────────────┬────────────────┬───────────────────┘
        ▼                 ▼                ▼                ▼
   PostgreSQL 16       Redis 7          MinIO (S3)     Anthropic API / Azure Speech
   (31 tables)      (rate limits,      (media)          (outside Uzbekistan)
                     idempotency)
```

**Request flow examples today**
1. *Parent login*: app → Supabase Auth → Supabase JWT stored in secure storage.
2. *Pick child*: app reads Supabase `children` → calls `POST /children/{id}/session` on FastAPI with Supabase JWT → gets child‑session JWT.
3. *Drawing game*: events queued by `TelemetryService` → `POST /sessions` then `POST /sessions/{id}/events` (child token) → background task computes metrics → updates `adaptation_profiles`, writes `adaptation_changes` → app fetches `/adaptive/profile`.
4. *Level complete*: `ProgressStore` (local) → `ProgressRepository.sync()` → upsert Supabase `child_task_progress` (not the backend's own `child_game_progress`).
5. *Parent dashboard*: `/parent/children/{id}/summary`, `/progress/*`, `/ai-assistant/chat`, `/aac/stats`, `/aac/insights`.

---

## 7. Existing Features

Legend: ✅ working & reachable · 🟡 partially working · 🔌 built but not reachable/wired · ⛔ not built

| Area | Feature | Status | Notes |
|---|---|---|---|
| Onboarding | Splash, language picker, guest registration (name/age stored locally) | ✅ | Guest mode keeps all data on device |
| Auth | Parent sign‑up / login (Supabase) | ✅ | To be replaced |
| Auth | Child picker (profiles from Supabase) | ✅ | |
| Auth | Parent gate (math question before parent areas) | ✅ | `FkParentGate` |
| Child play | Level map (`LevelsScreen`), 6 typing levels: letters, numbers, colors, fruits, animals, food | ✅ | Two letter stages + letter groups |
| Child play | Generic word/typing game with on‑screen keyboard | ✅ | Hardcoded content packs |
| Child play | Shapes game | ✅ | |
| Drawing | Tracing: letters (Latin + Cyrillic), numbers, objects | ✅ | |
| Drawing | Coloring: fruits, animals, nature, transport | ✅ | |
| Drawing | Connect‑dots, mazes, finger painting | ⛔ | In product vision |
| Curriculum | 16 levels (Letters…Stories) JSON + backend endpoints `/curriculum/*` | 🔌 | App does not consume them |
| Adaptive | Adaptive keyboard `FkKeyboard` with dwell/debounce/per‑key scale | 🔌 | Only in `LessonPlayerScreen` (unreachable) |
| Adaptive | Server engine: metrics, BKT, SM‑2, policy, audit log | 🟡 | Works; receives events only from drawing; ratchet bug B5 |
| Adaptive | Client offline fallback policy (`lib/features/adaptive/adaptive_policy.dart`) | 🟡 | |
| Rewards | Stars + local shop (`ShopScreen`, emoji items) | ✅ | Local only |
| Rewards | Server wallet/catalog/redeem + `CloudShopScreen` | 🔌 | |
| Mascot | Cloud mascot (CustomPaint), praise copy catalog | ✅ | |
| Audio | Letter/word pronunciation | 🟡 | Google Translate TTS (must replace) |
| AAC | Home, card grid, fringe, sentence strip, confirmation, neural TTS, custom cards with recorded audio, parent dashboard/settings/card manager, insights | ✅ | Most complete module |
| Parent | Home, progress (skills, time series, adaptation feed), settings, AI assistant | ✅ | Behind parent gate in Profile tab |
| Parent | Reports list, data export, delete child | 🟡 | Backend exists; UI partial |
| Teacher | Class list, class detail, assignment composer, analytics | 🔌 | Screens unreachable; analytics returns empty roster |
| Admin | Users, audit logs, feature flags, curriculum rollback, analytics, media upload | 🟡 | API only, no UI |
| Notifications | List + preferences | 🟡 | API only |
| Reports | Weekly report + PDF workers | 🟡 | No scheduler runs them |
| Payments | — | ⛔ | New |
| Therapist | — | ⛔ | New |

---

## 8. Web Version Requirements

### 8.1 What stays the same
- Product rules (§1), brand (colors, mascot, tone), 3 UI languages + 3 learning languages, AAC language rule.
- **FastAPI backend and its domain logic**; PostgreSQL schema (extended, not replaced); adaptive engine algorithms; AI service abstraction; AAC service; curriculum JSON as the content format.
- Mobile Flutter app continues to exist (updated to new auth + content API — see §33 Phase 7).

### 8.2 What changes
| Area | Change |
|---|---|
| Hosting | All personal data → servers in Uzbekistan |
| Auth | Supabase → FastAPI‑native auth (email+password, Google), web uses secure httpOnly cookies |
| Data | Two databases → one PostgreSQL; Supabase data migrated then Supabase shut down |
| Content | Hardcoded Dart content → curriculum JSON served by API/storage to both clients |
| Audio | Google Translate TTS → pre‑generated Azure neural MP3/Opus files + Azure live TTS only for AAC free text |
| Progress | Device‑local truth → **server truth** (online only on web) |
| Background jobs | In‑process tasks → a real queue worker (ARQ) + scheduled jobs |
| Roles | + therapist role, + school child accounts (no email) |
| Billing | New billing/subscription module (Payme, Click) |

### 8.3 What must be rebuilt for the web (Next.js)
Every screen. Nothing from Flutter UI code is reused directly; logic is re‑implemented in TypeScript following the same rules. Specifically: child play shell, adaptive keyboard, every game type, drawing/coloring canvases, AAC, mascot, parent dashboard, teacher dashboard, therapist dashboard, admin console, auth screens, billing screens, marketing pages.

### 8.4 Web‑specific capabilities required
- Input: **Pointer Events** (touch, mouse, pen) with the same signals as mobile (coordinates, offset from key center, down/up times), **plus physical keyboard** support (a new signal source — see §9.4).
- Audio: browsers block sound until the first user gesture → a "tap to start" moment in the child shell (designed as a friendly mascot wave, not an error).
- Fullscreen / kiosk‑like child mode (Fullscreen API) and orientation‑independent layouts.
- Accessibility: WCAG 2.2 AA for adult UI; child UI follows FK touch‑target rules; keyboard navigation for everything; screen‑reader labels; reduced motion.

---

## 9. Functional Requirements (per major feature)

Each feature below states: **Now** (what/how today) · **Web** (target behavior) · **FE** · **BE** · **DB** · **API** · **AuthZ** · **Acceptance criteria (AC)**. IDs like `FR-AUTH-1` are referenced by tests and the roadmap.

### 9.1 Accounts & authentication (parents, teachers, therapists, admins)
- **Now:** Supabase email/password in Flutter. Backend verifies Supabase JWT, lazily mirrors a `users` row with role `parent`. Legacy backend auth endpoints exist but are unused.
- **Web:** Users sign up / log in on `app.flexikeys.uz` with email+password or Google. Email verification required before adding a child. Password reset by email. Role chosen at sign‑up: *Parent* (default), *Teacher*, *Therapist*; teacher/therapist accounts start `pending_verification` and are approved by an admin (`SHOULD`: automatic approval for pilot).
- **FE:** `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, Google button (Google Identity Services), role selection, session refresh handled by the API client, logout everywhere.
- **BE:** Re‑enable and harden `modules/auth`; remove Supabase verification from `core/deps.py`; add cookie transport for web; keep bearer transport for mobile; transactional email sender (SMTP/provider) behind an interface; account lockout/backoff; role approval workflow.
- **DB:** `users` (+ `status`, `role` incl. `therapist`), `refresh_tokens` (rotation + reuse detection), `oauth_identities`, `email_tokens` (hashed single‑use tokens for verify/reset — replaces stateless JWT reset tokens), `login_attempts` (or Redis counters).
- **API:** `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /users/me`, `PATCH /users/me`, `DELETE /users/me`.
- **AuthZ:** Public endpoints rate‑limited per IP + per email. Reset/verify tokens single‑use, hashed at rest, 15 min / 24 h expiry.
- **AC:**
  - `FR-AUTH-1` A new parent can sign up with email+password, receives a verification email in their UI language, verifies, and lands on "Add your child".
  - `FR-AUTH-2` Google sign‑in creates or links an account by verified email without creating duplicates.
  - `FR-AUTH-3` A reset link works once; a second use fails with a friendly message.
  - `FR-AUTH-4` Refresh token reuse (stolen token replay) revokes the whole token family and forces re‑login.
  - `FR-AUTH-5` Existing Supabase users can log in after migration with their old password (see §13.5).

### 9.2 Child profiles & parental consent
- **Now:** Child created in Supabase then mirrored to backend; two consent records posted automatically after creation.
- **Web:** Parent adds a child (display name or nickname, birth year, learning language, UI language, avatar). **Consent screen shown and explicitly accepted before the child record is created**, in the parent's language, with separate optional consent for AI processing and voice recording. Parent can edit, export (JSON download) and delete a child (hard delete of personal data within 30 days, see §20).
- **FE:** Add‑child wizard (3 steps: consent → profile → avatar), child list, child settings, export, delete with confirmation.
- **BE:** Single transactional create: consent + child in one DB transaction. Remove Supabase path. Consent versioning (text version id stored).
- **DB:** `children`, `parental_consents` (+ `consent_version`, `scope`: `core`, `ai_processing`, `voice_recording`, `school_sharing`, `therapist_sharing`), `consent_texts` (versioned, localized).
- **API:** `GET /children/consent-text?lang=`, `POST /children` (body includes accepted consent ids), `GET /children`, `PATCH /children/{id}`, `DELETE /children/{id}`, `GET /children/{id}/export`.
- **AuthZ:** Only the owning parent (or admin) can read/modify; every child‑scoped query goes through a single `assert_can_access_child(user, child_id, permission)` guard (see §15.4).
- **AC:** `FR-CHILD-1` Creating a child without accepting core consent is impossible. `FR-CHILD-2` Parent A can never read/modify parent B's child (automated test for every child‑scoped endpoint). `FR-CHILD-3` Export contains all personal data of the child in machine‑readable form. `FR-CHILD-4` Deletion removes the child's personal data and pseudonymizes analytics within 30 days.

### 9.3 Child play shell (entry, navigation, parent gate)
- **Now:** Parent picks child → `MainShell` with 3 tabs (Levels, Shop, Profile behind parent gate). Guest mode possible.
- **Web:** Two entry paths:
  1. **Home:** Parent logged in → "Who is playing?" avatar picker → child mode (`/play`). Child mode is fullscreen‑capable, has no links out, and exiting to parent areas requires the parent gate (hold‑to‑unlock + simple arithmetic, localized, not readable by pre‑readers).
  2. **School:** Child opens `flexikeys.uz/class` (or scans QR) → enters class code (or teacher's classroom device is already bound to the class) → taps own avatar/name from the roster → optional picture password (3 pictures) → child mode.
- **No guest mode on web** (online only; all progress is server‑side). A "Try a demo" mode with one level and no data storage is `SHOULD` for marketing.
- **FE:** Child shell layout, world map, tap‑to‑start audio unlock, mascot presence, break overlay, parent gate component.
- **BE:** Child session token issuance for both paths; classroom device binding.
- **DB:** `child_sessions_auth` (active child tokens for revocation), `classroom_devices` (optional), `children.picture_password_hash` (optional).
- **API:** `POST /children/{id}/session` (parent path), `POST /class-login/start` (class code → roster), `POST /class-login/child` (child id + optional picture password → child token).
- **AuthZ:** Child tokens are short‑lived (8 h), scoped to exactly one child, carry no parent privileges, cannot call parent/teacher/admin endpoints.
- **AC:** `FR-PLAY-1` From parent login to first game ≤ 3 taps. `FR-PLAY-2` A child in class mode can play without any email/password. `FR-PLAY-3` A child cannot reach parent areas without the gate. `FR-PLAY-4` Sound plays after the first tap on all supported browsers.

### 9.4 Adaptive keyboard & typing lessons (core)
- **Now:** `FkKeyboard` (Flutter) supports per‑key scale, spacing, dwell time, debounce, hint highlight; `LessonPlayerScreen` runs typing items with ghost text; **not reachable**. Generic typing games use a simpler keyboard.
- **Web:** One `AdaptiveKeyboard` React component used by **all** typing activities. Layouts: Latin (en/uz incl. `oʻ gʻ sh ch ng` handling per `keyboard_layouts.dart`), Cyrillic (ru). Only keys needed by the current item may be shown (reduced keyboard) as the engine decides. Physical keyboard input accepted in parallel (desktop), mapped to the same event model with `input_source = physical_keyboard` (touch geometry fields null).
- **Behavior rules:** dwell time (press‑and‑hold before accept) and debounce from the profile; key growth animated gradually (≤ 5% per session, 200–400 ms ease); hint levels 0–3 (none → highlight → ghost hand → audio prompt); no negative feedback — a mistaken key produces a gentle neutral sound and the target key softly pulses.
- **FE:** Pointer Events on each key (`pointerdown`/`pointerup`/`pointercancel`), `touch-action: none` on the keyboard, sub‑millisecond timestamps via `event.timeStamp`, key center geometry from `getBoundingClientRect`, event batching (every 10 events or 5 s, and on `visibilitychange`/`pagehide` via `navigator.sendBeacon` fallback), deterministic client fallback if the profile fetch fails (defaults).
- **BE:** Unchanged event schema extended with `input_source`, `pointer_type`, `device_pixel_ratio`, `viewport_w/h`; server‑side validation that events belong to the child's own session.
- **DB:** `interaction_events` (+ new columns or JSONB payload fields), `learning_sessions` (+ `client_platform` = web|android|ios).
- **API:** `POST /sessions`, `POST /sessions/{id}/events` (idempotent by `batch_id`), `PATCH /sessions/{id}`, `GET /adaptive/profile`.
- **AuthZ:** Child token only; session ownership enforced (fixes B2).
- **AC:** `FR-KBD-1` Key sizes/spacing/dwell/debounce/hints on web exactly follow the profile fetched from `/adaptive/profile`. `FR-KBD-2` A tap shorter than `dwell_time_ms` is not accepted and is logged as `accidental_tap`. `FR-KBD-3` Repeated taps within `debounce_ms` are rejected. `FR-KBD-4` Physical keyboard works for typing items on desktop. `FR-KBD-5` Keyboard remains fully usable at 320 px width with keys ≥ 64×64 CSS px (horizontal scroll or reduced key set rather than shrinking below minimum).

### 9.5 Adaptive engine (server)
- **Now:** `modules/adaptive`: metrics (EWMA accuracy/latency, hesitation, accidental‑tap rate, fatigue index, touch precision, confusion matrix), BKT mastery, SM‑2 repetition, policy with bounded steps, audit log `adaptation_changes` with explanation keys. Runs as a FastAPI BackgroundTask after event ingest.
- **Web:** Same engine, shared by web and mobile. Required changes:
  1. **Fix hysteresis ratchet (B5):** hysteresis must expire (e.g., block opposite direction only for the *next* N=2 sessions or 48 h) and every "up" rule needs a matching "down" rule (dwell, spacing, global scale) with its own threshold, so help fades as the child improves.
  2. **Input‑source awareness:** touch‑precision/offset metrics only from `pointer_type = touch|pen`; mouse and physical keyboard feed accuracy/latency/hesitation but not geometry. Per‑child profiles may be **per input source** (a child can use a tablet at home and a keyboard at school): `adaptation_profiles` keyed by `(child_id, input_profile)` where `input_profile ∈ {touch, pointer, keyboard}`.
  3. **Run in the worker** (ARQ) instead of in‑process, so API latency stays low and jobs survive restarts.
  4. **Progression gate & repetition queue** exposed through `/curriculum/next` for all 16 levels.
- **AC:** `FR-ADAPT-1` Unit test: after sustained mastery (≥ 0.9 for 3 sessions) hints and per‑key scale return to baseline in bounded steps. `FR-ADAPT-2` Every change is written to `adaptation_changes` with a localized explanation key available in en/uz/ru. `FR-ADAPT-3` No parameter changes by more than one step per session. `FR-ADAPT-4` Event → profile update completes within 30 s p95 after batch ingest.

### 9.6 Curriculum (16 levels) & content delivery
- **Now:** JSON for 16 levels + schema; backend import tool; `/curriculum/*` endpoints; app ignores them and uses hardcoded Dart packs for 6 typing levels + drawing data.
- **Web:** All content (levels, lessons, items, localized words, images, audio references, drawing paths, coloring regions, AAC cards) comes from **versioned content bundles** generated from `shared/` JSON. The API returns level/lesson structure + mastery gates; heavy static files (images, audio, SVG paths) are served from object storage/CDN with content‑hashed filenames.
- **Content migration task:** Move everything in `lib/data/content_packs`, `lib/data/trace_items`, `lib/data/coloring_items` into `shared/curriculum` / `shared/drawing` JSON (one‑time script + manual review), so web and mobile use the same data.
- **Levels:** 1 Letters · 2 Numbers · 3 Shapes · 4 Colors · 5 Family · 6 Animals · 7 Fruits · 8 Vegetables · 9 Toys · 10 Transport · 11 Body Parts · 12 Clothes · 13 Nature · 14 Simple Words · 15 Sentences · 16 Stories — each with images, voice, animation, typing exercises, rewards, feedback, per learning language.
- **Activity types (game engines to build once, reuse across levels):** `listen_and_type` (hear word → type), `see_and_type` (image → type), `letter_find` (find key), `word_build` (ghost text), `match_sound` (animal sound → word), `shape_select`, `color_select`, `sentence_build`, `story_read_along`, `trace`, `color_fill`, `connect_dots` (new), `maze` (new), `finger_paint` (new).
- **FE:** Content loader with caching (HTTP cache + TanStack Query), activity engine registry, level map from API.
- **BE:** `/curriculum/*` extended with activity config; admin publishes content versions; rollback exists.
- **DB:** `curriculum_versions`, `levels`, `lessons`, `items`, `item_localizations`, `assets` (existing) + `activities` (type + JSON config) if not representable in `items`.
- **AC:** `FR-CUR-1` All 16 levels playable in all 3 learning languages. `FR-CUR-2` No word, letter or sentence string for children is hardcoded in React components. `FR-CUR-3` A new content version can be published and rolled back without deploying code. `FR-CUR-4` Levels unlock only by mastery (`progression_gate`), never by time or payment.

### 9.7 Drawing module (tracing, coloring, connect‑dots, mazes, finger painting)
- **Now:** Flutter CustomPaint screens: trace letters (Latin/Cyrillic), numbers, objects; coloring (4 sets); emits `trace_point` telemetry.
- **Web:** HTML Canvas 2D (or SVG for coloring regions) with Pointer Events and pointer capture; path tolerance adapted by the engine (wider tolerance for low precision); stroke smoothing; undo; "done" celebration. Tracing paths and coloring region shapes come from content JSON (SVG path data).
- **AC:** `FR-DRAW-1` Tracing tolerance follows the profile. `FR-DRAW-2` 60 fps drawing on a mid‑range tablet (e.g., 2021 iPad, Chromebook). `FR-DRAW-3` Finished artwork can be saved to the child's gallery (stored in object storage; visible to parent) — `SHOULD`.

### 9.8 Audio & voice
- **Now:** Google Translate TTS for words; pre‑generated Azure MP3 for AAC (uz only on disk) and some level audio; recorded custom AAC audio.
- **Web:** **Every** letter, word, sentence, instruction and mascot line has a pre‑generated audio file per language (Azure neural voice, one calm voice per language) + animal sounds. Audio manifest per content version maps `item_id → file URL`. Live Azure TTS only for AAC free‑form sentence strip. Web Audio API (via Howler.js) with preloading of the current lesson's audio; audio unlocked on first gesture.
- **BE:** Extend `tools/generate_level_audio.py` + `generate_aac_audio.py` into one pipeline producing Opus/MP3 per language into object storage; `/aac/tts` caches synthesized sentences (hash of text+voice) in storage.
- **AC:** `FR-AUD-1` Zero requests to translate.google.com. `FR-AUD-2` Missing audio fails CI (manifest completeness check for all 3 languages). `FR-AUD-3` Audio starts < 150 ms after tap for preloaded items.

### 9.9 Mascot & feedback
- **Now:** CustomPaint cloud; curated praise catalog (`lib/data/praise_copy.dart`).
- **Web:** SVG/CSS‑animated cloud (or Rive web runtime if a `.riv` is produced) with expressions: happy, thinking, sleeping, celebrating, encouraging, surprised, waving. `MascotController` equivalent: `setExpression()`, `say(messageKey)`. All copy from localized catalog; effort‑based only; respects `prefers-reduced-motion`.
- **AC:** `FR-MAS-1` No mascot line exists without all 3 translations and audio. `FR-MAS-2` Lint rule/test rejects exclamation spam and banned words ("wrong", "fail", "perfect!!").

### 9.10 Rewards (stars, coins, cloud shop)
- **Now:** Local stars + emoji shop (device only); server wallet/catalog/redeem + `/rewards/earn` (client‑trusted, B3).
- **Web:** **Server‑authoritative rewards**: the backend grants coins/stars when it processes `item_completed` / lesson completion events (rules in `reward_definitions`), never from a client‑supplied amount. Cloud shop sells cosmetic items (mascot hats, colors, backgrounds, avatar items) for coins. No purchasable coins, ever.
- **API:** remove `POST /rewards/earn`; keep `GET /rewards/wallet`, `GET /rewards/catalog`, `POST /rewards/{id}/redeem`, `PUT /rewards/equip`.
- **AC:** `FR-REW-1` It is impossible to increase coins via any client request other than completing activities. `FR-REW-2` Subscription status has no effect on coins, stars or item prices.

### 9.11 AAC "My Voice"
- **Now:** Most complete module: categories (needs, feelings, people, places, play, daily activities), core/fringe vocabulary, sentence strip, confirmation, per‑card audio, custom cards with parent photo + recorded audio, AI sentence composition, insights, stats; follows **UI language**; events stored locally in drift then synced.
- **Web:** Same behavior. Online only → events posted directly (small in‑memory retry queue). Custom card photos/audio uploaded to object storage (in Uzbekistan) via pre‑signed URLs; audio recording via MediaRecorder API (requires microphone permission; parent area only).
- **API:** existing `/aac/events`, `/aac/compose`, `/aac/tts`, `/aac/insights`, `/aac/stats` + new `/aac/cards` CRUD (custom cards currently local‑only), `/media/upload-url`.
- **AuthZ:** Child token for events/compose/tts; parent/therapist (linked) for insights/stats; parent only for custom cards.
- **AC:** `FR-AAC-1` Changing UI language mid‑composition re‑renders and cancels in‑flight audio (parity with Flutter). `FR-AAC-2` Custom cards sync across web and mobile. `FR-AAC-3` AI never runs on AAC data without `ai_processing` consent.

### 9.12 Parent dashboard
- **Now:** Parent home (children, summary), progress (skills, timeseries, adaptation feed), settings, AI assistant, AAC dashboard/card manager/settings; reports & export partially.
- **Web (`/parent`):** Overview per child (time played, streak, mastery by skill, recent adaptations in plain language), progress charts, **"What changed and why"** feed, weekly reports (web + PDF + email), AAC dashboard, AI assistant, therapist/teacher sharing management (approve/revoke), subscription & billing, notification preferences, privacy (export/delete), account settings.
- **AuthZ:** Parent only for own children.
- **AC:** `FR-PAR-1` Every adaptation change is visible with a localized, non‑technical sentence. `FR-PAR-2` Parent can revoke a therapist/teacher link and access stops immediately. `FR-PAR-3` Dashboard loads < 2 s p75 on 4G.

### 9.13 AI assistant & AI features
See §16 for detail. Features: parent assistant (existing), AAC sentence help + insights (existing), teacher AI helper (new), AI‑generated weekly reports (new).

### 9.14 Reports & notifications
- **Now:** `daily_rollup.py`, `weekly_report.py`, `pdf_report.py` functions, `reports` + `notifications` tables; nothing schedules them.
- **Web:** Scheduled jobs (ARQ cron): nightly rollup → `daily_activity`; weekly report every Sunday 18:00 Asia/Tashkent per child → stored + PDF in storage + email/in‑app notification (respecting preferences). In‑app notification center in parent/teacher/therapist dashboards. Email via transactional provider; **SMS out of scope** for launch.
- **AC:** `FR-REP-1` Weekly report generated for every active child with consent. `FR-REP-2` PDF downloadable from dashboard via short‑lived signed URL.

### 9.15 Teacher / school
- **Now:** Classes with join codes, enrollment, assignments, analytics stub; screens unreachable; B4 authz bug.
- **Web (`/teacher`):** Create class (name, grade, learning language), get class code + printable QR poster; **two ways to add children**: (a) parents join with class code (links existing child; requires parent's `school_sharing` consent), (b) teacher creates **school‑managed child profiles** (nickname + avatar only, no email) — requires the school to confirm it holds parental consent forms (checkbox + upload of consent template; see Open Question Q3). Assignments (choose levels/lessons, due date), class analytics (mastery heatmap by skill, time on task, children needing attention — phrased positively), per‑child view (progress + adaptation log, read‑only), AI helper.
- **AC:** `FR-TCH-1` A teacher only sees children enrolled in their own classes. `FR-TCH-2` Class code login works on a shared classroom device for 30 children in sequence. `FR-TCH-3` Removing a child from a class revokes teacher access immediately.

### 9.16 Therapist / specialist (new)
- **Web (`/therapist`):** Therapist account (admin‑verified). Link to a child by **parent invitation** (parent enters therapist's email or shares a one‑time link code; therapist accepts) — parent can revoke any time. Therapist sees: progress, adaptation log, AAC usage/insights, session history; can write **private notes** and **goals** (visible to parent, `SHOULD` toggle); can recommend activities (appear as suggestions in parent dashboard). Cannot change adaptation, cannot see other children of the family, cannot export data.
- **DB:** `care_links(id, child_id, professional_user_id, kind: therapist|teacher, status: invited|active|revoked, invited_by, created_at, revoked_at)`, `therapist_notes`, `goals`.
- **AC:** `FR-THR-1` Therapist access exists only while an active parent‑approved link exists. `FR-THR-2` All therapist reads are recorded in `audit_logs`.

### 9.17 Admin console
- **Now:** API for users, audit logs, feature flags, curriculum rollback, analytics, media upload; no UI.
- **Web (`/admin`):** Users (search, verify teacher/therapist, disable), subscriptions (view, refund marker, grant comp), content versions (upload/publish/rollback, audio manifest completeness), feature flags, audit logs, system health, AI usage/cost, support tools (resend email, revoke sessions). Admin actions require re‑authentication within the last 15 min and are audit‑logged.
- **AC:** `FR-ADM-1` Every admin mutation creates an audit log entry with actor, target, diff.

### 9.18 Billing & subscriptions (new) — Payme, Click
- **Model:** Family subscription (monthly / yearly) in UZS. **Free tier** (Open Question Q1 — proposed: 1 child, levels 1–4, AAC core vocabulary always free because AAC is a communication aid). Paid tier: all levels, multiple children, reports, AI assistant. Schools/therapists: free access for linked children during pilot (licensing `LATER`).
- **Rule:** payment gates *access to content areas*, never rewards, progression speed or adaptation.
- **Flow:**
  - **One‑off / manual renewal (MUST):** Parent chooses plan → backend creates `order` → redirect to Payme checkout / Click checkout → provider calls our **merchant callback endpoints** (server‑to‑server) → we validate signature/auth, amounts and order state → mark paid → entitlement extended.
  - **Recurring (SHOULD):** card tokenization (Payme Subscribe API `cards.*` + `receipts.*`; Click card‑token API), stored **token only** (never card numbers), renewal job charges token N days before expiry, retries with notification on failure.
- **BE:** `modules/billing`: provider‑agnostic `PaymentProvider` interface; `PaymeProvider` (Merchant API JSON‑RPC: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`), `ClickProvider` (SHOP API `Prepare` / `Complete` with signature check). Idempotent state machine. Fiscal receipt requirements (OFD / fiscalization via provider) — confirm with providers (Open Question Q4). *All provider method names must be verified against the providers' current documentation during Phase 6.*
- **DB:** `plans`, `subscriptions`, `orders`, `payment_transactions` (provider, provider_txn_id unique, state, amounts in tiyin, timestamps, raw payload JSONB), `payment_methods` (token, masked PAN, expiry), `entitlements` (derived, cached).
- **API:** `GET /billing/plans`, `POST /billing/checkout`, `GET /billing/subscription`, `POST /billing/cancel`, `POST /billing/payme` (provider callback), `POST /billing/click/prepare`, `POST /billing/click/complete`.
- **AC:** `FR-BILL-1` Duplicate provider callbacks never double‑credit. `FR-BILL-2` Amount mismatch or unknown order is rejected with the provider‑specified error code. `FR-BILL-3` Entitlement change is reflected in the app within 10 s of `PerformTransaction`/`Complete`. `FR-BILL-4` Test (sandbox) payments pass for both providers before go‑live.

### 9.19 Localization
- **Web:** `next-intl` with en/uz/ru message catalogs generated from the existing ARB files (one‑time conversion script) — `lib/l10n/app_*.arb` stays the source for mobile; a shared `packages/i18n` JSON becomes the source for both going forward (Flutter ARB generated from it). UI language in URL prefix for public pages (`/uz`, `/ru`, `/en`), user preference for app pages. Learning language per child. Uzbek Latin apostrophe characters (`oʻ`, `gʻ`, `ʼ`) normalized consistently (U+02BB/U+02BC).
- **AC:** `FR-L10N-1` CI fails if any key is missing in any language. `FR-L10N-2` Switching UI language never changes the child's learning language.

---

## 10. Non‑Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Availability | 99.5% monthly for API and web during pilot; 99.9% target after 12 months |
| NFR-2 | Performance | See §21 |
| NFR-3 | Security | OWASP ASVS L2 for auth/session; OWASP Top 10 mitigations; see §19 |
| NFR-4 | Privacy | Uzbek personal‑data law, COPPA/GDPR‑K‑style posture; see §20 |
| NFR-5 | Accessibility | WCAG 2.2 AA for adult UI; child UI: targets ≥ 64 CSS px, no time pressure, reduced motion, full audio support |
| NFR-6 | Maintainability | Typed end to end (Pydantic → OpenAPI → generated TS client); lint + type + tests in CI |
| NFR-7 | Observability | Structured logs, error tracking, uptime checks, business metrics; see §27 |
| NFR-8 | Recoverability | RPO ≤ 24 h (≤ 15 min `SHOULD` with WAL archiving), RTO ≤ 4 h; restore tested monthly |
| NFR-9 | Portability | Everything runs in Docker; no lock‑in to a single Uzbek provider |
| NFR-10 | Cost | ≤ $100/month infrastructure at launch excl. AI/TTS usage (AI budget cap enforced in code) |

---

## 11. Frontend Requirements (Next.js web)

### 11.1 Stack
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+ (App Router), React, TypeScript (strict)** | Owner's decision; SSR for marketing, client components for app |
| Styling | **Tailwind CSS** with FK design tokens as CSS variables; component primitives from **Radix UI** (accessible) | Fast, consistent, accessible |
| Server state | **TanStack Query** | Caching, retries, background refresh |
| Client state | **Zustand** (game/session state) | Small, simple |
| Forms | React Hook Form + **Zod** | Validation shared with API types |
| API types | **openapi-typescript** + `openapi-fetch` generated from FastAPI's OpenAPI | No hand‑written API types |
| i18n | **next-intl** | App Router support, ICU plurals |
| Audio | **Howler.js** (Web Audio) | Preload, sprites, mobile unlock |
| Drawing | Canvas 2D (+ `perfect-freehand` for strokes), SVG for coloring regions | Performance, precision |
| Charts | Recharts (parent/teacher dashboards) | |
| Animation | CSS transitions + Framer Motion (respect reduced motion) | |
| Mascot | SVG + CSS/Framer Motion (or `@rive-app/react-canvas` if `.riv` created) | |
| Testing | Vitest + React Testing Library, Playwright (E2E), axe‑core | |
| Lint/format | ESLint (next, jsx‑a11y), Prettier, TypeScript `strict` | |

### 11.2 App areas (route groups)
```
/(marketing)        /, /pricing, /for-schools, /for-therapists, /privacy, /terms   (SSR, SEO, public)
/(auth)             /login, /signup, /verify-email, /forgot-password, /reset-password
/class              class‑code entry & roster (school child login)
/play               child mode (client‑only, fullscreen‑capable): map, level, activity, AAC, shop, gallery
/parent             parent dashboard
/teacher            teacher dashboard
/therapist          therapist dashboard
/admin              admin console
```
- `middleware.ts` checks the presence of the session cookie and role claim to redirect between areas (real authorization is **always** enforced by the API, never only in the frontend).
- **No personal data is fetched in Next.js server components** unless the Next.js server runs in Uzbekistan (it will — see §30). Default: app pages are client components calling the API directly from the browser with cookies; marketing pages are server‑rendered without personal data.

### 11.3 Child UI rules (web)
- Minimum target 64×64 CSS px; adaptive keyboard may grow to 96+ px; spacing from profile.
- No text walls; every instruction also spoken; icons + audio for pre‑readers.
- No red, no "wrong"; neutral soft sound on miss.
- No links out, no ads, no third‑party scripts, no analytics SDKs (enforced by CSP on `/play` and `/class`).
- Keyboard + switch‑friendly focus order (`SHOULD`: single‑switch scanning mode `LATER`, see Q7).
- Session pacing: break overlay when `session_pacing.suggest_break` is true.

### 11.4 New web redesign
- Keep brand palette (Indigo `#6C63E0`, Sky `#4A90D9`, Coral `#E0567B`, Leaf `#4CAF50`, Sunshine `#FFC107`, Grape `#9C27B0`, Tangerine `#FF8C42`, Lavender Mist `#E8ECFA`, ink `#2A2F45` / `#6B7186`), Nunito, 16–32 px radii, cloud mascot.
- New layouts designed for: desktop 1280–1920, tablet landscape/portrait, phone (parent dashboards), projector (teacher view).
- Deliverable before Phase 3: web design spec (Figma or coded design gallery at `/dev/design`) covering tokens, atoms (button, card, input, chip, avatar, mascot), keyboard, activity layouts, dashboards. Tokens stored once in `packages/design-tokens/tokens.json` → generated to CSS variables (web) and Dart constants (mobile).

---

## 12. Backend Requirements

### 12.1 Keep
FastAPI app structure (`router.py → service.py → repository.py`, `schemas.py`, `models.py` per module), async SQLAlchemy, Alembic, Pydantic v2, structlog, RFC 7807 errors, idempotent event ingest.

### 12.2 Change / add
| # | Requirement |
|---|---|
| BE-1 | Remove Supabase: `core/deps.get_current_user` verifies **backend‑issued** access tokens (cookie or bearer); delete `supabase_jwt_secret` |
| BE-2 | Central authorization guard `assert_can_access_child(principal, child_id, perm)` used by **every** child‑scoped endpoint (parent owner, active care link, teacher of enrolled class, admin) |
| BE-3 | Session/event ownership checks (B2), server‑authoritative rewards (B3), join‑class parent check (B4), policy fix (B5) |
| BE-4 | New modules: `billing`, `care_links` (therapist), `class_login`, `content` (bundles/manifests), `email` (transactional sender), `ai_reports`, `teacher_ai` |
| BE-5 | Queue worker: **ARQ** (Redis‑based, async, Python) process running adaptive pipeline, reports, emails, AI jobs, billing renewals; ARQ cron for scheduled jobs |
| BE-6 | Object storage client (S3 API) with pre‑signed upload/download URLs; MinIO or Uzbek S3‑compatible storage |
| BE-7 | CORS allowlist for web origins; CSRF protection for cookie‑authenticated mutations |
| BE-8 | OpenAPI spec published at build time into `packages/api-client` |
| BE-9 | AI budget guard: per‑user daily quota + global monthly cost cap |
| BE-10 | Health endpoints: `/healthz` (liveness), `/readyz` (DB+Redis) |
| BE-11 | Fix CI: ruff, mypy strict, test harness (async tests), coverage gates |

### 12.3 Module map (target)
`auth, users, children, consents, class_login, care_links, curriculum, content, sessions, adaptive, progress, rewards, parent, teacher, therapist, admin, ai_assistant, ai_reports, teacher_ai, aac, notifications, email, media, billing` — each with README, tests.

---

## 13. Database Requirements

### 13.1 Engine & location
- **PostgreSQL 16**, one database `flexikeys`, hosted **in Uzbekistan** (managed Postgres from an Uzbek cloud provider if available and within budget; otherwise Docker Postgres on the Uzbek VM with automated backups — see §30).
- Normalized 3NF; JSONB only for adaptation params, event payloads, provider raw payloads.
- All timestamps `timestamptz` UTC; display in Asia/Tashkent by default.
- UUID primary keys (existing convention).

### 13.2 Existing tables (keep; see Appendix C)
31 tables incl. `users, children, parental_consents, learning_sessions, interaction_events, adaptation_profiles, adaptation_changes, skill_mastery, repetition_queue, level_progress, child_game_progress, daily_activity, wallets, reward_definitions, reward_grants, classes, class_enrollments, assignments, assignment_status, ai_conversations, ai_messages, notifications, notification_preferences, reports, audit_logs, feature_flags, curriculum_versions, levels, lessons, items, item_localizations, assets, aac_events, refresh_tokens, oauth_identities`.

### 13.3 New tables
| Table | Purpose |
|---|---|
| `email_tokens` | Hashed single‑use verify/reset tokens |
| `consent_texts` | Versioned, localized consent documents |
| `care_links` | Parent‑approved therapist/teacher access to a child |
| `therapist_notes`, `goals` | Therapist content |
| `class_devices` (SHOULD) | Classroom device binding |
| `aac_custom_cards` | Server‑side custom AAC cards (today local only) |
| `media_objects` | Uploaded files (owner, child, kind, storage key, size, mime, sha256) |
| `plans`, `subscriptions`, `orders`, `payment_transactions`, `payment_methods`, `entitlements` | Billing |
| `ai_usage` | Tokens/cost per request for quotas |
| `content_bundles` | Published content versions + audio manifests |

### 13.4 Changes to existing tables
- `users.role` enum + `therapist`; `users.status` (`active|pending_verification|disabled`); `users.password_hash` supports argon2 **and legacy bcrypt** (for migrated Supabase users; rehash on login).
- `children`: + `managed_by` (`parent|school`), `school_class_id` (nullable), `picture_password_hash` (nullable).
- `adaptation_profiles`: key becomes `(child_id, input_profile)`.
- `learning_sessions`: + `client_platform`, `input_profile`.
- `interaction_events`: + `input_source`, `pointer_type` (in payload JSONB or columns; indexes on `(session_id, created_at)` already expected).
- **Partitioning `interaction_events` by month** (`SHOULD`) — the largest table (10k children × ~500 events/day ≈ 150M rows/month at full scale); retention: raw events 13 months, then aggregated.

### 13.5 Data migration from Supabase (one‑time)
1. Export Supabase `auth.users` (id, email, encrypted_password = bcrypt hash, email_confirmed_at, created_at, raw_user_meta_data), `public.children`, `public.child_task_progress`.
2. Import into backend `users` preserving UUIDs (the backend already uses the Supabase UUID as `users.id`, so foreign keys line up), `password_hash = bcrypt hash` flagged `legacy_bcrypt`.
3. Reconcile `children` (backend already has mirrored rows; Supabase rows missing in backend are inserted; conflicts logged for manual review).
4. Map `child_task_progress` → `child_game_progress` / `level_progress`.
5. Verify counts + checksums; dry‑run on staging; then cut over; Supabase project set read‑only for 30 days, then deleted (after data‑deletion confirmation).
6. Because the data law applies from day one, the current Supabase data (outside Uzbekistan) should be migrated **before** onboarding any new real users (see Risk R3).

### 13.6 Backups
Nightly `pg_dump` (compressed, encrypted with age/GPG) to a **second storage location inside Uzbekistan**; 30 daily + 12 monthly retention; WAL archiving (pgBackRest) `SHOULD`; monthly restore drill (documented runbook).

---

## 14. API Requirements

### 14.1 Conventions
- Base URL `https://api.flexikeys.uz/api/v1` (domain TBC). JSON only. `snake_case` fields.
- **Versioning:** `/api/v1`; breaking changes → `/api/v2` while mobile clients still use v1.
- **Errors:** RFC 7807 `application/problem+json` with a stable `code` (e.g., `child_not_found`, `consent_required`, `subscription_required`) that clients translate; never expose stack traces.
- **Pagination:** `limit` (max 100) + `cursor`.
- **Idempotency:** `Idempotency-Key` header for POSTs that create things (checkout, event batches use `batch_id`).
- **Rate limits:** per IP and per principal (Redis); `429` with `Retry-After`.
- **Auth transport:** web → httpOnly cookies + CSRF header; mobile → `Authorization: Bearer`.
- **Typed:** every endpoint has request and response Pydantic models; OpenAPI is the contract; TS client generated in CI.

### 14.2 Target endpoint map (new = ★, changed = ✎)
```
auth        ✎ POST /auth/register  ✎ /auth/login  ★ /auth/google  ✎ /auth/refresh  /auth/logout ★ /auth/logout-all
            ✎ /auth/verify-email ★ /auth/resend-verification ✎ /auth/forgot-password ✎ /auth/reset-password
users       GET/PATCH/★DELETE /users/me
children    GET /children/consent-text  POST/GET /children  PATCH/★DELETE /children/{id}  ★GET /children/{id}/export
            POST /children/{id}/session  ✎ POST /children/{id}/consent
class-login ★ POST /class-login/start  ★ POST /class-login/child
curriculum  GET /curriculum/levels  /levels/{slug}/lessons  /lessons/{id}  /next   ★ GET /content/manifest?lang=&version=
sessions    POST /sessions  ✎ PATCH /sessions/{id}  ✎ POST /sessions/{id}/events
adaptive    ✎ GET /adaptive/profile?input_profile=
progress    ✎ GET /progress/skills|timeseries|adaptations?child_id=  (authz)   GET/PUT /progress/sync (mobile)
rewards     GET /rewards/wallet  /rewards/catalog  POST /rewards/{id}/redeem  ★PUT /rewards/equip   ✗ remove POST /rewards/earn
aac         POST /aac/events /aac/compose /aac/tts  GET /aac/insights /aac/stats  ★ CRUD /aac/cards
parent      GET /parent/children/{id}/summary  /parent/reports  ★GET /parent/reports/{id}/pdf-url
            ★ POST /parent/children/{id}/care-links  ★ DELETE /parent/care-links/{id}
teacher     /teacher/classes (CRUD) ✎ /teacher/classes/join  /assignments  ✎ /analytics  ★ /classes/{id}/children (school‑managed)
            ★ POST /teacher/ai/summary
therapist   ★ GET /therapist/children  ★ POST /therapist/care-links/{id}/accept  ★ CRUD /therapist/children/{id}/notes|goals
ai          POST /ai-assistant/chat  GET /ai-assistant/conversations(/{id})
reports     ★ (worker‑generated; read via parent/teacher/therapist endpoints)
notifications GET /notifications  ★POST /notifications/{id}/read  PUT /notifications/preferences
media       ★ POST /media/upload-url  ★ POST /media/{id}/complete  ✎ POST /media/upload (admin)
billing     ★ GET /billing/plans  ★ POST /billing/checkout  ★ GET /billing/subscription  ★ POST /billing/cancel
            ★ POST /billing/payme (provider)  ★ POST /billing/click/prepare  ★ POST /billing/click/complete (provider)
admin       GET /admin/users ★PATCH /admin/users/{id}  /audit-logs  /feature-flags  /curriculum/rollback ★/content/publish
            /analytics ★/subscriptions ★/ai-usage
health      ★ GET /healthz  ★ GET /readyz
```

---

## 15. Authentication & Authorization

### 15.1 Recommended system (beginner summary)
The backend itself is the "login server". When you log in, it checks your password (hashed with **Argon2id**), then gives your browser two **tokens**: a short‑lived **access token** (15 min) and a long‑lived **refresh token** (30 days). On the web these are stored in **httpOnly cookies** — JavaScript cannot read them, which protects them from XSS attacks. The mobile app receives the same tokens in the JSON response and stores them in secure storage.

### 15.2 Token design
| Token | Lifetime | Web storage | Mobile storage | Contents |
|---|---|---|---|---|
| Access (JWT, HS256→**EdDSA/RS256 `SHOULD`**) | 15 min | `__Host-fk_at` cookie, httpOnly, Secure, SameSite=Lax, Path=/ | secure storage | `sub`, `role`, `sid` (session id), `exp` |
| Refresh (opaque random, hashed in DB) | 30 d, rotated on every use | `__Host-fk_rt` cookie, httpOnly, Secure, SameSite=Strict, Path=/api/v1/auth | secure storage | — |
| Child session (JWT) | 8 h | in memory + sessionStorage‑free cookie `fk_ct` scoped to child mode | secure storage | `sub=child_id`, `type=child_session`, `granted_by` (parent/teacher), `lang`, `input_profile` |

- **CSRF:** cookie‑authenticated state‑changing requests must include `X-CSRF-Token` matching a non‑httpOnly `fk_csrf` cookie (double‑submit) — or rely on `SameSite` + `Origin` header check; implement both.
- **Refresh rotation + reuse detection:** each refresh token belongs to a family; reuse of a rotated token revokes the family.
- **Google:** web uses Google Identity Services → sends Google ID token to `POST /auth/google` → backend verifies signature/audience via Google JWKS (code exists) → login or link by verified email.
- **Web and API on the same site** (`app.flexikeys.uz` + `api.flexikeys.uz`, or better: API proxied under `app.flexikeys.uz/api` by the reverse proxy) so cookies are first‑party.

### 15.3 Roles
`parent`, `teacher`, `therapist`, `admin` (users) + `child` (session principal only, not a user).

### 15.4 Authorization model
- **Role check** (can this role call this endpoint at all) + **resource check** (can this principal access *this* child/class/order).
- Single guard function, one place, fully unit‑tested:
```
can_access_child(principal, child_id, perm):
  admin                       → yes (audited)
  parent  & child.parent_id == principal.id → yes
  therapist & active care_link(kind=therapist) → read perms only
  teacher   & child enrolled in teacher's class & (school‑managed or parent school_sharing consent) → read + assign
  child     & principal.child_id == child_id → child perms only
  else → 404 (not 403, to avoid revealing existence)
```
- Every child‑scoped endpoint has an automated **cross‑tenant test** (parent B / teacher B / therapist unlinked → 404).

---

## 16. AI/ML Requirements

### 16.1 Principles
- Provider‑agnostic `LlmProvider` interface (exists). Default provider Anthropic (Claude, current production model configured via `AI_MODEL`, e.g. `claude-sonnet-5`); stub for tests/dev.
- **Data minimization & cross‑border:** AI providers are outside Uzbekistan. Send **only pseudonymized, aggregated data**: no names, no birth years, no free text typed by the child except AAC card labels needed for composition; child referred to as "the child". Requires `ai_processing` consent; without it AI features are hidden. (Legal confirmation: Q2.)
- **Never generates child‑facing copy at runtime** (except AAC sentence composition, which only reorders/joins the child's own chosen cards and is shown for confirmation).
- Medical disclaimer (`MEDICAL_DISCLAIMER`) whenever health/development topics appear; system prompts forbid diagnosis.
- **Cost control:** per‑user daily message quota (e.g., 30 parent messages/day), per‑report token cap, monthly global cap with graceful degradation to stub message.
- All prompts versioned in code; outputs stored (`ai_messages`, `reports`) for audit; parent can delete conversations.
- Localized: respond in the user's UI language (uz/ru/en); evaluate Uzbek quality in QA.

### 16.2 Features
| Feature | Status | Input | Output | Trigger |
|---|---|---|---|---|
| Parent assistant | Exists | Question + grounded context (skills, mastery, recent adaptations, AAC stats) + tools (existing `_build_tools`) | Answer + suggested activities | Parent chat |
| AAC sentence composition | Exists | Ordered card labels + language | Natural sentence (confirmed by child/parent) | Sentence strip |
| AAC insights | Exists | Aggregated AAC stats | Plain‑language insights | Weekly / on demand |
| **AI weekly report** | New | Week's aggregates: time, mastery deltas, adaptations, AAC usage | 150–250‑word localized summary + 3 suggested activities; PDF | ARQ weekly job |
| **Teacher AI helper** | New | Class aggregates (pseudonymized IDs → mapped back client‑side) | Class summary, grouping suggestions, assignment suggestions | Teacher request |

### 16.3 Non‑LLM ML
The adaptive engine is deterministic (BKT, EWMA, SM‑2, rule policy). **No ML model training in scope.** Collect data so a future model can replace `policy.apply()` behind the same interface (documented in `policy.py`).

### 16.4 Acceptance
`FR-AI-1` No request to an AI provider contains a child's name or birth year (test with request capture). `FR-AI-2` Disclaimer present for medical‑keyword questions in all 3 languages. `FR-AI-3` Quotas enforced; over‑quota returns a friendly localized message. `FR-AI-4` AI features invisible without `ai_processing` consent.

---

## 17. User Roles & Permissions

| Capability | Child | Parent | Teacher | Therapist | Admin |
|---|---|---|---|---|---|
| Play activities, AAC, shop | ✅ own | — | — | — | — |
| Create/edit/delete child | — | ✅ own | school‑managed only (in own class) | — | ✅ |
| Give consent | — | ✅ | attests school consent | — | — |
| View progress / adaptation log | — | ✅ own | ✅ enrolled | ✅ linked | ✅ |
| View AAC insights | — | ✅ | — (`LATER`) | ✅ linked | ✅ |
| Change adaptation | ❌ | ❌ | ❌ | ❌ | ❌ (engine only; admin can reset profile with audit) |
| Assignments | receive | view | ✅ create | recommend | — |
| Notes / goals | — | view | — | ✅ | — |
| AI assistant | ❌ | ✅ | ✅ teacher helper | ✅ (`SHOULD`) | — |
| Billing | ❌ | ✅ | — | — | view/comp |
| Export/delete data | — | ✅ own | — | — | ✅ on request |
| Content, flags, users | — | — | — | — | ✅ |

---

## 18. Admin / Parent / Child / Teacher / Therapist functionality (screen inventory)

**Child (`/play`):** tap‑to‑start → world map (16 levels, locked levels shown as sleeping clouds, not padlocks) → level → lesson/activity player (typing, listen, match, drawing, coloring, story) → celebration → map; AAC "My Voice" tab; cloud shop & wardrobe; my gallery (drawings); break overlay; parent gate exit.

**Parent (`/parent`):** overview; child switcher; progress (skills, time series, streak); "What changed and why"; reports (weekly, PDF); AAC dashboard + custom cards + settings; AI assistant; sharing (therapists/teachers, class codes); subscription & payments; notifications; privacy (consents, export, delete); account.

**Teacher (`/teacher`):** classes; class detail (roster, code/QR poster, add school‑managed children); assignments; analytics heatmap; child detail (read‑only); AI helper; classroom mode (projector‑friendly roster login).

**Therapist (`/therapist`):** my children (linked); child detail (progress, adaptations, AAC); notes; goals; recommendations; invitations.

**Admin (`/admin`):** users & verification; subscriptions; content versions & audio manifest; feature flags; audit logs; AI usage; system health; support tools.

---

## 19. Security Requirements

| ID | Requirement |
|---|---|
| SEC-1 | Fix B1–B5 before any production data; add cross‑tenant tests for every child‑scoped endpoint |
| SEC-2 | TLS 1.2+ everywhere (Let's Encrypt via Caddy); HSTS preload; no plain HTTP |
| SEC-3 | Security headers: strict CSP (no inline scripts except Next.js nonce), `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone only on AAC card manager) |
| SEC-4 | Argon2id hashing (existing params); password policy: ≥ 10 chars, breached‑password check (k‑anonymity HIBP API — `SHOULD`, note cross‑border hash prefix only) |
| SEC-5 | Rate limiting on auth, AI, TTS, class‑login (class code brute force: 10/min/IP, codes ≥ 6 chars from unambiguous alphabet) |
| SEC-6 | Payment callbacks: verify Payme Basic auth credentials / Click signature; allowlist provider IPs where documented; idempotent |
| SEC-7 | Secrets only in environment/secret files on the server (never in git); `.env.example` documents keys; rotate on staff change |
| SEC-8 | Dependency scanning (Dependabot / `pip-audit` / `npm audit`) in CI; container image scanning (Trivy) |
| SEC-9 | Uploads: size limits, MIME sniffing, image re‑encoding (strip EXIF/GPS), audio transcoding, private buckets, pre‑signed URLs ≤ 15 min |
| SEC-10 | Admin: re‑auth for sensitive actions, audit log, (`SHOULD`) TOTP 2FA for admin/teacher/therapist |
| SEC-11 | Database: least‑privilege DB user for the app, separate migration user; no public DB port; SSH key‑only access; firewall (only 80/443 public) |
| SEC-12 | Remove `backend/.venv` from git; purge history of any secrets if found (scan with gitleaks) |
| SEC-13 | Pre‑launch external security review / penetration test (`SHOULD`) |

---

## 20. Privacy Requirements

| ID | Requirement |
|---|---|
| PRV-1 | **Data localization:** all personal data of Uzbek citizens (accounts, children, progress, events, AAC, recordings, payments metadata, logs containing personal data) collected, stored and processed on servers physically located in Uzbekistan (Law "On Personal Data" ZRU‑547, Art. 27¹). Register the database in the State register of personal‑data databases (verify current procedure with a lawyer — Q2) |
| PRV-2 | Global CDN/third parties only for **non‑personal** data: static JS/CSS, curriculum images, pre‑generated audio |
| PRV-3 | Cross‑border AI/TTS processing only with explicit consent and pseudonymized payloads (§16); list processors in privacy policy |
| PRV-4 | Minimal child PII: nickname, birth year, avatar; no child email/phone; no photos of the child required (custom AAC photos optional, parent‑controlled) |
| PRV-5 | Telemetry pseudonymized at ingest (child UUID only; no names in event tables); IP addresses not stored with events |
| PRV-6 | No third‑party analytics/ads/trackers in child areas; adult areas: self‑hosted privacy‑friendly analytics only (e.g., Plausible/Umami self‑hosted in Uzbekistan) — `SHOULD` |
| PRV-7 | Consent records versioned and exportable; withdrawal of consent disables the related processing within 24 h |
| PRV-8 | Retention: raw interaction events 13 months; deleted accounts purged in 30 days; backups age out in ≤ 12 months (documented) |
| PRV-9 | Parent rights: access (export), correction, deletion, withdraw consent — self‑service |
| PRV-10 | Privacy policy + terms in 3 languages; child‑friendly explanation for parents |
| PRV-11 | Update `docs/pii-inventory.md` for every new table/field containing personal data |

---

## 21. Performance Requirements

| Metric | Target |
|---|---|
| Marketing pages LCP (4G, mid phone) | < 2.5 s |
| App first load (child mode) JS | < 250 KB gzipped initial route; activities code‑split |
| Tap → key visual feedback | < 50 ms (no network in the loop) |
| Tap → audio (preloaded) | < 150 ms |
| API p95 latency (reads) | < 300 ms in Uzbekistan |
| Event batch ingest p95 | < 200 ms (processing async) |
| Profile update after batch | < 30 s p95 |
| Drawing | 60 fps on mid‑range tablet |
| Dashboard load | < 2 s p75 |

---

## 22. Scalability Requirements

- **Target year 1:** 10,000 children, ~1,000 concurrent at school peak (09:00–12:00 Tashkent), ~500 events/child/day → ~5M events/day peak scenario (~60/s average, bursts 500/s).
- **Stage 1 (≤ 2k children):** single VM (4 vCPU / 8 GB): Caddy + Next.js + FastAPI (2–4 Uvicorn workers) + ARQ worker + Postgres + Redis + MinIO in Docker Compose.
- **Stage 2 (≤ 10k):** split DB to its own VM or managed Postgres; 2 app VMs behind the provider's load balancer; object storage on provider S3; `interaction_events` partitioning; read replica `SHOULD`.
- **Design rules now so scaling later is easy:** stateless API (sessions in DB/Redis only), all files in object storage (never local disk), background work in the queue, idempotent jobs, config via env.
- **Load test** (k6) before launch: 1,000 concurrent children sending events + 200 dashboard users.

---

## 23. Responsive Design Requirements

| Breakpoint | Child mode | Adult dashboards |
|---|---|---|
| ≥ 1280 (desktop) | Centered stage with max width, large keyboard, side mascot | Sidebar navigation, multi‑column |
| 768–1279 (tablet, landscape/portrait) | **Primary child target**; full‑screen stage; keyboard bottom | Collapsible sidebar |
| < 768 (phone) | Supported (AAC, drawing, short activities); keyboard may show reduced key set | Single column, bottom nav |
| Projector (teacher) | — | High contrast, large type classroom mode |

Orientation changes never lose progress; touch targets never shrink below minimums; `100dvh` layout; safe‑area insets.

---

## 24. Browser Compatibility

| Browser | Version | Priority |
|---|---|---|
| Chrome / Edge (Windows, macOS, ChromeOS, Android) | last 2 major | MUST |
| Safari iPadOS / iOS | 16.4+ | MUST (Web Audio unlock, Pointer Events, MediaRecorder support verified) |
| Safari macOS | 16.4+ | MUST |
| Firefox | last 2 major | SHOULD |
| Yandex Browser (Chromium) | current | SHOULD (common in Uzbekistan) |
| Samsung Internet | current | SHOULD |
| Internet Explorer / legacy Edge | — | Not supported (friendly upgrade page) |

---

## 25. File / Image / Media Handling

| Kind | Source | Storage | Delivery |
|---|---|---|---|
| Curriculum images/SVG | Content repo (`shared/`) | Object storage `content/` bucket (public, content‑hashed) | CDN allowed (non‑personal) |
| Pre‑generated audio (letters, words, mascot, AAC core cards) | Azure batch pipeline | `content/audio/{lang}/{hash}.opus` + `.mp3` fallback | CDN allowed |
| AAC live TTS | `/aac/tts` | `tts-cache/` private (sentences may be personal) | Via API / signed URL, stored in Uzbekistan |
| Custom AAC card photos & recordings | Parent upload (MediaRecorder / file input) | `user-media/` private bucket in Uzbekistan | Pre‑signed GET ≤ 15 min |
| Child drawings | Canvas export PNG/WebP | `user-media/` private | Signed URL |
| Report PDFs | Worker | `reports/` private | Signed URL |
| Upload rules | Max image 5 MB (re‑encoded to WebP ≤ 1024 px, EXIF stripped); max audio 30 s / 2 MB (transcoded to Opus); allowed MIME allowlist; virus scan (ClamAV) `SHOULD` |

---

## 26. Error Handling

- **Child UI:** never shows an error message. Network problem → mascot "sleeping" + "Let's wait a moment" (spoken) with automatic retry; activity progress kept in memory and resent. Unexpected crash → React error boundary shows mascot and "Let's go back to the map".
- **Adult UI:** clear localized messages from `problem+json` `code`; retry buttons; form field errors inline.
- **API:** RFC 7807; validation errors list fields; 404 for unauthorized resource access (don't leak existence); 5xx logged with correlation id returned in `X-Request-ID`.
- **Workers:** retries with exponential backoff; dead‑letter log; alert on repeated failures.
- **Payments:** provider‑specified error codes returned exactly; any inconsistency logged + alert.

---

## 27. Logging & Monitoring

| Need | Tool (budget‑friendly, data stays in Uzbekistan) |
|---|---|
| Structured logs | structlog JSON (backend), pino (Next.js) → Docker log driver → **Loki + Grafana** (self‑hosted) or files with rotation (Stage 1) |
| Errors | **GlitchTip** (self‑hosted, Sentry‑compatible SDKs) — Sentry SaaS not used for PII reasons |
| Uptime | Uptime Kuma (self‑hosted) + external ping (non‑personal `/healthz`) |
| Metrics | Prometheus FastAPI instrumentator + node exporter → Grafana (`SHOULD`) |
| Business metrics | Admin analytics endpoint (active children, sessions, conversions, AI cost) |
| Alerts | Telegram bot notifications to owner (common in Uzbekistan) for downtime, error spikes, failed backups, payment anomalies |
| Log hygiene | No passwords, tokens, child names or AAC sentence text in logs; request ids everywhere |

---

## 28. Testing Strategy

| Level | Backend | Web | Mobile |
|---|---|---|---|
| Unit | pytest: adaptive metrics/policy/mastery/repetition (≥ 90% coverage), auth, billing state machine, authz guard | Vitest: keyboard logic (dwell/debounce), event batching, formatters | existing flutter tests |
| Integration | pytest + **testcontainers** Postgres/Redis (or CI services); every endpoint happy path + authz matrix | React Testing Library for components with MSW mocked API | — |
| Contract | OpenAPI diff check in CI (breaking change detection); generated TS client compiles | — | Flutter DTOs against OpenAPI (`SHOULD`) |
| E2E | — | **Playwright**: signup→consent→child→play→progress visible; class code login; payment sandbox; therapist link/revoke; language switching | smoke on real devices |
| Accessibility | — | axe‑core in Playwright; manual screen reader pass; keyboard‑only pass | — |
| Visual | — | Playwright screenshots for key screens | golden tests |
| Load | k6 against staging | — | — |
| Security | bandit, pip‑audit, authz matrix, ZAP baseline scan on staging | npm audit, CSP check | — |
| Content | JSON schema validation, audio manifest completeness, l10n completeness | — | — |
| Usability | Sessions with 5+ children incl. children with motor difficulties (with therapist present) before launch | | |

**CI gates (every PR):** ruff, mypy strict, pytest (+coverage gates), ESLint, `tsc --noEmit`, Vitest, Playwright smoke on preview, content validation, OpenAPI diff.

---

## 29. Deployment Strategy

- **Environments:** `local` (Docker Compose) → `staging` (small Uzbek VM, sandbox payments, test data only) → `production`.
- **Build:** GitHub Actions builds Docker images (`web`, `api`, `worker`) tagged with git SHA → pushes to a container registry (GitHub Container Registry holds **code only, no personal data** — acceptable).
- **Deploy:** GitHub Actions SSHs to server → `docker compose pull && docker compose up -d` (Stage 1); migrations run as a separate one‑off container **before** the new API starts (`alembic upgrade head`); **expand‑and‑contract** migrations so old and new code both work during deploy.
- **Rollback:** previous image tag redeploy (< 5 min); DB migrations written to be backward compatible.
- **Release process:** feature branches → PR → CI green → merge to `main` → auto‑deploy to staging → manual promote to production (tag `vX.Y.Z`).
- **Mobile:** Flutter builds unaffected by web deploys; API v1 kept backward compatible for installed app versions; minimum supported app version endpoint (`GET /meta/app-version`).

---

## 30. Hosting Requirements

### 30.1 Constraints
Personal data must stay in Uzbekistan → Supabase, Vercel (for personalized SSR), Render, Railway, Fly **cannot** host personal data. Budget $25–100/month.

### 30.2 Recommended Stage‑1 setup
| Component | Where | Notes |
|---|---|---|
| VM #1 "app" (4 vCPU, 8 GB RAM, 100+ GB SSD) | Uzbek cloud provider (candidates to evaluate: Uzinfocom/UZCLOUD, Uztelecom cloud, other licensed local data centers — compare price, SLA, backups, S3 availability) | Docker Compose: Caddy (TLS, reverse proxy), `web` (Next.js standalone), `api` (FastAPI/Uvicorn), `worker` (ARQ), Redis, Postgres (unless managed PG available), MinIO |
| Backup storage | Second Uzbek location (provider object storage or second small VM) | Encrypted nightly dumps + MinIO mirror |
| DNS | Any (e.g., Cloudflare DNS **only**, proxy disabled for API/app) | DNS contains no personal data |
| Static content CDN (optional) | Cloudflare/Bunny for `content.flexikeys.uz` | Only non‑personal curriculum media & JS; verify legal comfort |
| Email | Transactional provider — **personal data (email addresses) leaves the country**; evaluate a local SMTP relay or provider with legal basis (Q5) | |
| Container registry | GHCR | Code only |

Estimated monthly (verify with providers): VM $30–70, backup storage $5–15, domain ~$1–2, email $0–15 → **within $100**. AI/TTS usage billed separately (cap in code, e.g., $30/month initially).

### 30.3 Stage 2 (≥ ~2k active children)
Separate DB VM (or managed PG), 2 app VMs + load balancer, provider S3, Grafana stack on its own small VM.

---

## 31. Environment Configuration

All config via environment variables (12‑factor). `.env` files never committed; `infra/.env.example` and `backend/.env.example` updated.

| Variable | Service | Example / note |
|---|---|---|
| `APP_ENV` | api, worker | `development|staging|production` |
| `APP_SECRET_KEY` / `JWT_PRIVATE_KEY` | api | long random / key pair |
| `DATABASE_URL` | api, worker | `postgresql+asyncpg://…` |
| `REDIS_URL` | api, worker | |
| `CORS_ORIGINS` | api | `https://app.flexikeys.uz` |
| `COOKIE_DOMAIN`, `COOKIE_SECURE` | api | |
| `GOOGLE_CLIENT_ID` | api, web | |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_CONTENT`, `S3_BUCKET_USER_MEDIA`, `S3_PUBLIC_CONTENT_URL` | api, worker | replaces `STORAGE_*` |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MONTHLY_BUDGET_USD`, `AI_USER_DAILY_QUOTA` | api, worker | |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | api, tools | |
| `SMTP_*` / `EMAIL_PROVIDER_*`, `EMAIL_FROM` | worker | |
| `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST_KEY`, `PAYME_CHECKOUT_URL` | api | |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID` | api | |
| `GLITCHTIP_DSN` | api, web | self‑hosted |
| `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CONTENT_BASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | web (build) | public only |
| `TELEGRAM_ALERT_BOT_TOKEN`, `TELEGRAM_ALERT_CHAT_ID` | monitoring | |

---

## 32. Development Phases (overview)

| Phase | Name | Weeks (plan) | Outcome |
|---|---|---|---|
| 0 | Foundations & fixes | 1 | Repo restructure, CI green, security fixes B1–B5, `.venv` removed |
| 1 | Backend: auth, single DB, infra | 2 | Supabase removed; auth w/ cookies + Google; Docker stack on staging VM in Uzbekistan; backups |
| 2 | Content & audio pipeline | 1 (parallel with 3) | All 16 levels + drawing + AAC in JSON; audio generated; manifest API |
| 3 | Web foundation & design system | 1–2 | Next.js app, tokens, atoms, i18n, API client, auth screens, parent onboarding + consent |
| 4 | Child experience | 3 | Play shell, adaptive keyboard, activity engines, drawing, AAC, rewards, mascot |
| 5 | Parent, AI, reports | 1.5 | Dashboard, what‑changed feed, assistant, weekly AI reports, notifications |
| 6 | Teacher, therapist, billing, admin | 2 | Classes/class login, therapist links, Payme/Click, admin console |
| 7 | Mobile alignment, migration, hardening, launch | 1.5 | Flutter uses new auth/content; Supabase data migrated; load/security/a11y tests; production go‑live |

Sum ≈ 13–14 weeks with parallelism assumptions → **exceeds 3 months for one person** even with AI agents (see R1). §33 defines cut lines.

---

## 33. Migration Roadmap (with cut lines)

**Principle:** build the backend changes first (the web and mobile both depend on them), then the web app, then switch mobile, then move users.

| Week | Backend | Web | Content/Infra | Milestone |
|---|---|---|---|---|
| 1 | Phase 0: fix B1–B5, CI green, authz guard, tests | Scaffold Next.js monorepo app | Choose Uzbek provider, order staging VM, domain | **M0: safe backend** |
| 2 | Auth rework (cookies, refresh rotation, Google, email tokens) | Design system tokens + atoms | Staging stack via Compose, TLS, backups | |
| 3 | Remove Supabase, users/children/consent transactional, therapist role + care_links schema, ARQ worker | Auth + onboarding + consent + child picker | Content JSON migration script; audio pipeline | **M1: log in on web (staging)** |
| 4 | Content bundle/manifest API, session/events changes, profile per input source, policy fix shipped | Play shell, tap‑to‑start, mascot, map | Audio generated for levels 1–6 | |
| 5 | Rewards server‑authoritative | Adaptive keyboard + typing activity engines | Levels 7–12 content review | **M2: child can play levels 1–6 adaptively on web** |
| 6 | — | Drawing/tracing/coloring engines, connect‑dots/maze | Levels 13–16 content + audio | |
| 7 | AAC custom cards API, media upload | AAC module, shop/wardrobe | | **M3: all child features** |
| 8 | Reports jobs, AI reports, notifications, email | Parent dashboard, what‑changed, assistant, reports | | **M4: parent experience** |
| 9 | Teacher endpoints, class login, teacher AI | Teacher dashboard + class login | | |
| 10 | Billing (Payme + Click sandbox), entitlements | Therapist dashboard, billing UI | | **M5: all roles + payments sandbox** |
| 11 | Admin endpoints | Admin console | Flutter: switch auth + content API | |
| 12 | Supabase data migration dry‑run → real | E2E, a11y, load, security fixes | Production VM, monitoring | **M6: launch** |

**Cut lines if behind schedule (decide at end of week 6):**
1. First to move to post‑launch: admin console UI (use scripts + API docs), connect‑dots/maze/finger painting, recurring payments (keep one‑off), teacher AI helper, therapist notes/goals (keep read‑only links), projector classroom mode.
2. Second: therapist role entirely, AI weekly reports (keep rule‑based report), levels 15–16.
3. Never cut: security fixes, consent, data localization, adaptive keyboard, parent dashboard basics, backups.

---

## 34. Technical Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Scope vs. time:** full vision + redesign + new roles + payments in 3 months by one person | Very high | High | Cut lines (§33), AI agents per phase with this PRD as spec, weekly milestone review, reuse backend logic |
| R2 | Owner new to backend/devops → outages, lost data | High | High | Managed‑as‑possible setup, runbooks, automated backups + restore drill, staging first, Appendix A learning path |
| R3 | Uzbek data law compliance (current Supabase data abroad; AI/TTS/email abroad) | Medium | High | Migrate before onboarding new users; legal review (Q2, Q5); pseudonymization; consent |
| R4 | Uzbek cloud provider limits (no managed PG/S3, weaker SLA) | Medium | Medium | Docker everything; portable; backups to 2nd location |
| R5 | Payment integration complexity & certification timelines (Payme/Click merchant onboarding, fiscalization) | High | Medium | Start merchant applications in week 1; sandbox early; one‑off payments first |
| R6 | Two frontends (Next.js + Flutter) drift apart | High | Medium | Shared OpenAPI client, shared content JSON, shared tokens JSON, shared l10n JSON; features land in API first |
| R7 | Browser audio/touch quirks (iOS Safari autoplay, pointer latency) | Medium | High (child UX) | Tap‑to‑start, early device testing, Playwright + real iPad testing weekly |
| R8 | Adaptive signals differ between touch/mouse/keyboard | High | Medium | Per‑input‑profile adaptation, input‑aware metrics |
| R9 | Content volume (16 levels × 3 languages × audio) | High | Medium | Pipeline + CI completeness checks; native‑speaker review budget |
| R10 | Event volume growth | Medium | Medium | Batching, partitioning, retention |
| R11 | Mobile users break when auth switches | Medium | High | Force‑update endpoint, migration of Supabase passwords (bcrypt), staged rollout |
| R12 | AI cost overrun | Low | Medium | Quotas + monthly cap |

---

## 35. Open Questions

| ID | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | Free tier definition (proposed: 1 child, levels 1–4, AAC core always free)? Prices (UZS monthly/yearly)? | Owner | Week 6 |
| Q2 | Legal confirmation: data localization scope (does it cover pseudonymized data sent to AI/TTS?), registration in the State register, parental consent wording, age thresholds | Lawyer | Week 2 |
| Q3 | School‑managed child profiles: acceptable consent evidence from schools? | Lawyer + pilot schools | Week 8 |
| Q4 | Payme/Click merchant accounts, fiscal receipt (OFD) requirements, legal entity (LLC/IP) status | Owner | Week 1 (start) |
| Q5 | Email provider acceptable under localization (local SMTP relay vs. international provider)? | Owner + lawyer | Week 2 |
| Q6 | Domain name(s): `flexikeys.uz`? | Owner | Week 1 |
| Q7 | Switch‑access / eye‑gaze support needed for launch (children with severe CP)? | Owner + therapists | Week 4 |
| Q8 | Which Uzbek cloud provider (price/SLA/managed PG/S3 comparison) | Owner | Week 1 |
| Q9 | Design: who produces the redesign (owner, designer, AI‑generated coded gallery)? | Owner | Week 1 |
| Q10 | Should the Flutter app keep offline play while web is online‑only? (Recommended: yes, mobile keeps local queue) | Owner | Week 11 |
| Q11 | Teacher/therapist verification: manual admin approval or document upload? | Owner | Week 9 |

---

## 36. Acceptance Criteria (launch)

The web launch is accepted when **all** are true:

1. All `MUST` functional requirements' ACs in §9 pass (automated where marked FR‑*).
2. Security: B1–B5 fixed with regression tests; cross‑tenant authz test matrix green; ZAP baseline no High findings; secrets not in git.
3. Privacy: all personal data verified to reside on Uzbek servers (data‑flow diagram reviewed); consent flows live in 3 languages; export and deletion work end to end.
4. Content: 16 levels (or cut‑line subset) playable in en/uz/ru with complete audio manifest; no Google Translate TTS calls.
5. Adaptive: web events produce profile changes visible on the parent "what changed" feed within 30 s; policy tests prove gradual rise **and** decay.
6. Performance targets in §21 met on staging with k6 load of 1,000 concurrent children.
7. Accessibility: axe no serious/critical issues on adult pages; child pages meet FK target sizes; reduced motion honored.
8. Payments: Payme + Click sandbox scenarios (success, cancel, duplicate callback, amount mismatch) pass; at least one real small payment verified in production.
9. Operations: backups running + one successful restore drill; monitoring and Telegram alerts working; runbooks written (deploy, rollback, restore, rotate secrets).
10. Mobile app released against the new auth/content API; Supabase data migrated and Supabase project frozen.
11. Usability session with children (incl. children with motor difficulties) completed and critical findings fixed.

---

## 37. Recommended Folder Structure

```
flexikeys/
├── CLAUDE.md                     # update: new layout, web stack, auth, hosting
├── apps/
│   ├── web/                      # Next.js (NEW)
│   │   ├── app/
│   │   │   ├── [locale]/(marketing)/…
│   │   │   ├── (auth)/login|signup|…
│   │   │   ├── class/…
│   │   │   ├── play/             # child mode (client components)
│   │   │   ├── parent/…  teacher/…  therapist/…  admin/…
│   │   │   └── layout.tsx
│   │   ├── src/
│   │   │   ├── design-system/    # tokens (generated), atoms, molecules, mascot, keyboard
│   │   │   ├── features/         # auth, children, play, activities/*, drawing, aac, rewards,
│   │   │   │                     # parent, teacher, therapist, admin, billing, ai
│   │   │   ├── lib/              # api client wrapper, audio, telemetry batching, i18n
│   │   │   └── stores/           # zustand stores
│   │   ├── messages/             # generated from packages/i18n
│   │   ├── tests/  e2e/
│   │   └── Dockerfile
│   └── mobile/                   # existing Flutter app moved from repo root (android/ ios/ lib/ test/ pubspec.yaml)
├── backend/                      # FastAPI (existing, extended)
│   ├── src/flexikeys/{core,modules,services,workers}/
│   ├── alembic/
│   ├── tests/
│   └── Dockerfile
├── packages/
│   ├── api-client/               # generated TS client from OpenAPI
│   ├── design-tokens/            # tokens.json → CSS vars + Dart
│   ├── i18n/                     # en/uz/ru JSON → next-intl + ARB
│   └── content/                  # was shared/: curriculum, drawing, aac, schemas, audio manifests
├── tools/                        # audio generation, content migration, data migration scripts
├── infra/
│   ├── compose/                  # docker-compose.{local,staging,prod}.yml
│   ├── caddy/Caddyfile
│   ├── backup/                   # scripts + systemd timers/cron
│   └── monitoring/               # glitchtip, uptime-kuma, grafana (optional)
├── docs/
│   ├── adr/                      # + ADR-006 web Next.js, ADR-007 remove Supabase / data localization,
│   │                             #   ADR-008 billing, ADR-009 cookie auth
│   ├── web-migration/PRD.md      # this document
│   └── runbooks/                 # deploy, rollback, restore, incident, secrets rotation
└── .github/workflows/            # ci-backend.yml, ci-web.yml, ci-mobile.yml, deploy.yml
```
Loose root files (screenshots, `.pptx`, images, `voice_uzb*`) move to `docs/assets/` or out of the repo; `backend/.venv` removed from git; decide on the `flexikeys-website 6` and `pixel-agents` submodules (marketing site becomes `apps/web` marketing routes).

---

## 38. Recommended Web Architecture

```
            Browser (child tablet / parent laptop / teacher PC)
                 │  HTTPS (TLS 1.3)
                 ▼
   ┌─────────────────────── Uzbek data center (VM, Docker Compose) ───────────────────────┐
   │  Caddy reverse proxy  (TLS certs, HTTP→HTTPS, security headers, gzip/br)              │
   │    ├── app.flexikeys.uz/*        → web  (Next.js standalone server, SSR marketing +    │
   │    │                                    client‑rendered app areas)                     │
   │    └── app.flexikeys.uz/api/*    → api  (FastAPI, Uvicorn workers)                     │
   │                                                                                         │
   │  web ──(no personal data server‑side by default)                                       │
   │  api ──► PostgreSQL 16   api ──► Redis 7 (rate limits, cache, ARQ queue)               │
   │  api ──► MinIO/S3 (private user media, reports, tts cache)                             │
   │  worker (ARQ) ──► same DB/Redis/S3; runs adaptive pipeline, reports, emails, billing   │
   │  glitchtip, uptime‑kuma, (grafana/loki)                                                 │
   └─────────────────────────────────────────────────────────────────────────────────────┘
                 │ only pseudonymized / non‑personal, with consent
                 ▼
   Anthropic API (AI) · Azure Speech (AAC live TTS) · Payme / Click (payments) · Google (sign‑in) · Email provider
                 ▲
   content.flexikeys.uz (optional CDN) ← public curriculum images/audio/JS (non‑personal)
```

**How the browser talks to the backend:** the browser loads the Next.js app from `app.flexikeys.uz`. React components call `app.flexikeys.uz/api/v1/...` (same origin → cookies just work, no CORS complexity). TanStack Query caches responses. The child play area loads the lesson from the API, preloads images/audio from `content.flexikeys.uz`, sends interaction events in batches, and re‑fetches the adaptive profile after each lesson.

**Mobile app:** the Flutter app calls the same `https://app.flexikeys.uz/api/v1` with Bearer tokens.

---

## 39. Recommended Backend Architecture

```
HTTP request
   │
   ▼
FastAPI app (main.py)
   ├─ middleware: request id → logging → CORS → CSRF/origin check → rate limit
   ├─ dependencies: get_db (session per request), get_principal (cookie/bearer → user or child), authz guard
   ▼
router.py   (HTTP only: parse/validate with Pydantic, call service, return schema)
   ▼
service.py  (business rules; calls own repository and OTHER modules' services — never their repositories)
   ▼
repository.py (SQLAlchemy queries only)
   ▼
PostgreSQL

Asynchronous work:
service ──enqueue──► Redis (ARQ queue) ──► worker process
                                             ├─ adaptive.process_session_events (metrics → BKT → SM‑2 → policy → audit log)
                                             ├─ reports.daily_rollup (cron 02:00) / weekly_report (Sun 18:00)
                                             ├─ ai_reports.generate / teacher_ai.summarize
                                             ├─ email.send
                                             ├─ billing.renewals (cron hourly) / reconcile
                                             └─ privacy.purge_deleted (cron daily)

External adapters (each behind an interface, stub in tests):
   services/ai_service.py (LlmProvider) · services/tts (Azure) · services/storage (S3) ·
   services/email (SMTP/provider) · modules/billing/providers (Payme, Click) · auth/google (JWKS)
```

**Adaptive data flow (end to end):** child taps key → web records event (target, actual, timestamps, offset, input source) → batch `POST /sessions/{id}/events` (idempotent `batch_id`) → API validates ownership, stores rows, enqueues job → worker computes metrics & mastery, applies bounded policy, writes new `adaptation_profiles` version + `adaptation_changes` rows (with explanation keys) → web fetches `/adaptive/profile` at next lesson start → keyboard gently adapts → parent sees "Keys for **b** got a little bigger because they were tricky this week".

---

## 40. Step‑by‑step Implementation Plan

Each step is sized for one PR (or one AI‑agent task) and lists its "done when". Do them in order; steps in the same week marked ∥ can run in parallel.

### Phase 0 — Foundations & fixes (week 1)
1. `chore: remove backend/.venv from git`, add `.venv/` to `.gitignore`; gitleaks scan. **Done when** repo has no venv files.
2. `fix(tests)`: convert `test_teacher*.py` to async tests; CI services for Postgres/Redis. **Done when** `pytest` passes locally with compose DB.
3. `style`: `ruff check --fix`, manual fixes; mypy fixes. **Done when** CI backend job green.
4. `feat(core)`: `authz.can_access_child()` guard + test matrix. **Done when** used by progress, parent, aac, teacher, sessions.
5. `fix(progress)`: ownership (B1). `fix(sessions)`: session ownership (B2). `fix(rewards)`: remove `/earn`, server grants (B3). `fix(teacher)`: parent check on join (B4). Each with regression tests.
6. `fix(adaptive)`: hysteresis expiry + decrease rules (B5) with multi‑session tests.
7. ADRs: 006 (Next.js web), 007 (remove Supabase, data localization), 008 (cookie auth). Update `CLAUDE.md`.

### Phase 1 — Backend auth, single DB, infra (weeks 2–3)
8. `feat(auth)`: backend‑issued tokens accepted in `get_principal`; cookie transport + CSRF; refresh rotation/reuse detection; `email_tokens`; `logout-all`.
9. `feat(auth)`: Google sign‑in endpoint (reuse JWKS verification).
10. `feat(email)`: email service interface + SMTP implementation + localized templates (verify, reset, report).
11. `feat(users)`: roles `therapist`, `status`; bcrypt legacy verify + rehash.
12. `feat(children)`: transactional create with consent; consent texts versioned; export; delete + purge job.
13. `feat(worker)`: ARQ worker service, move adaptive pipeline from BackgroundTasks, cron scaffolding.
14. `feat(storage)`: S3 client + pre‑signed URLs + `media_objects`.
15. `infra`: `docker-compose.staging.yml` (caddy, web, api, worker, postgres, redis, minio), Caddyfile, backup script + restore runbook; provision staging VM in Uzbekistan; deploy workflow.
16. `feat(health)`: `/healthz`, `/readyz`; GlitchTip + Uptime Kuma.

### Phase 2 — Content & audio (weeks 3–6, ∥)
17. `tools`: migrate `lib/data/*` Dart content → `packages/content` JSON (script + review).
18. Content schema extended for activity types, drawing paths, coloring regions; validator in CI.
19. Audio pipeline: one command generates all missing audio for all languages → storage + manifest; CI completeness check.
20. `feat(content)`: publish bundle + `/content/manifest`; admin publish/rollback endpoints.

### Phase 3 — Web foundation (weeks 2–4, ∥)
21. Scaffold `apps/web` (Next.js, TS strict, Tailwind, ESLint, Vitest, Playwright), CI job.
22. `packages/design-tokens` → CSS variables; atoms (Button, Card, Input, Chip, Avatar, Dialog) + `/dev/design` gallery.
23. `packages/i18n` from ARB; next‑intl wiring; language switcher.
24. `packages/api-client` generated from OpenAPI; fetch wrapper with cookie/CSRF + refresh‑on‑401.
25. Auth screens + Google button; parent onboarding (consent → child → avatar); child picker; parent gate.

### Phase 4 — Child experience (weeks 4–7)
26. Play shell: fullscreen, tap‑to‑start audio unlock, error boundary, break overlay, mascot controller.
27. Telemetry client: session start/end, batched events, `sendBeacon` on hide.
28. `AdaptiveKeyboard`: layouts (Latin/uz digraphs, Cyrillic), dwell, debounce, per‑key scale, spacing, hints 0–3, physical keyboard; unit tests for timing logic.
29. Activity engines: listen_and_type, see_and_type, letter_find, word_build, match_sound, shape_select, color_select, sentence_build, story_read_along.
30. World map + level/lesson flow from `/curriculum/*` + `/curriculum/next`; celebration screens; rewards display.
31. Drawing: trace, color_fill; then connect_dots, maze, finger_paint (cut‑line).
32. AAC: home, categories, fringe, sentence strip, confirmation, neural TTS, UI‑language live switching.
33. Shop/wardrobe + equip; gallery.

### Phase 5 — Parent, AI, reports (weeks 7–8)
34. Parent overview, progress charts, "what changed and why" feed (localized explanation keys).
35. AI assistant UI (streaming `SHOULD`), quotas, disclaimer, consent gating.
36. Weekly report job + AI summary + PDF + notification + email; reports UI.
37. AAC parent dashboard, custom cards (upload/record), settings.
38. Privacy center: consents, export, delete; sharing management (care links).

### Phase 6 — Teacher, therapist, billing, admin (weeks 9–11)
39. Teacher classes, code/QR poster, school‑managed children, class login flow, assignments, analytics, child view.
40. Teacher AI helper.
41. Therapist: invitations/accept, linked children, read views, notes, goals, recommendations; audit logging of reads.
42. Billing: plans, orders, entitlements, Payme Merchant API callbacks, Click Prepare/Complete, checkout redirect, subscription page, sandbox tests; recurring (cut‑line).
43. Admin console: users/verification, content versions, flags, audit logs, subscriptions, AI usage.

### Phase 7 — Mobile alignment, migration, hardening, launch (weeks 11–12)
44. Flutter: replace Supabase with backend auth (bearer), children/progress via API, content from manifest, audio from pipeline (remove Google TTS); release to stores.
45. Supabase → Postgres migration script; dry‑run on staging; production run; freeze Supabase.
46. Load test (k6), ZAP scan, axe pass, real‑device matrix (iPad Safari, Android Chrome, Chromebook, Windows laptop).
47. Production VM, DNS, TLS, monitoring, alerts, backups + restore drill; runbooks.
48. Usability sessions with children; fix critical issues; go‑live checklist (§36).

---

## Appendix A — Backend 101 glossary (for a beginner)

| Term | Plain explanation | In FlexiKeys |
|---|---|---|
| **Frontend** | The code that runs in the user's browser/phone and draws the screens | Next.js web app, Flutter mobile app |
| **Backend** | Code running on a server that stores data, applies rules and talks to other services | FastAPI (Python) |
| **API** | The list of URLs the frontend can call to ask the backend to do things, e.g. `GET /children` | §14 |
| **Endpoint** | One URL + method in the API (`POST /sessions`) | |
| **HTTP methods** | GET = read, POST = create/do, PATCH/PUT = change, DELETE = remove | |
| **JSON** | The text format data travels in: `{"name": "Ali"}` | |
| **Database (PostgreSQL)** | Organized permanent storage in tables (like spreadsheets with strict rules) | 31+ tables |
| **Table / row / column / foreign key** | A table holds one kind of thing; a row is one item; a column is one field; a foreign key links rows (child → parent) | `children.parent_id → users.id` |
| **Migration (Alembic)** | A versioned script that changes the database structure safely; run with `alembic upgrade head` | `backend/alembic/versions` |
| **ORM (SQLAlchemy)** | Lets Python code work with tables as classes instead of writing raw SQL | `models.py` |
| **Schema (Pydantic)** | Defines and validates the shape of data coming in/out of the API | `schemas.py` |
| **Router / Service / Repository** | Three layers: router handles HTTP, service holds business rules, repository talks to the DB | every module |
| **Authentication** | Proving who you are (login) | §15 |
| **Authorization** | Deciding what you're allowed to do (parent A cannot see child of parent B) | `can_access_child` |
| **Password hashing (Argon2id)** | Storing a scrambled one‑way version of the password so even a database leak doesn't reveal it | |
| **JWT / token** | A signed "ticket" the backend gives after login; the frontend shows it on each request | access/refresh/child tokens |
| **Cookie (httpOnly)** | Small data the browser stores and sends automatically; httpOnly ones can't be read by JavaScript (safer) | web auth |
| **CORS** | Browser rule controlling which websites may call your API | avoided by same‑origin `/api` |
| **CSRF** | An attack where another site tricks the browser into sending your cookies; blocked by tokens/SameSite | §15.2 |
| **Redis** | Very fast in‑memory storage used for counters, caching and queues | rate limits, ARQ |
| **Queue / worker (ARQ)** | Slow jobs are put in a queue and done by a separate process, so the user doesn't wait | adaptive pipeline, reports |
| **Cron** | Schedule to run a job at fixed times | weekly reports |
| **Object storage (S3/MinIO)** | Storage for files (images, audio, PDFs) addressed by keys, not folders on a disk | media |
| **Pre‑signed URL** | Temporary link that allows uploading/downloading one private file | custom AAC audio |
| **Docker / container** | Packages an app with everything it needs so it runs the same everywhere | api, web, worker images |
| **Docker Compose** | Starts several containers together with one file | `infra/compose/*.yml` |
| **Reverse proxy (Caddy)** | The front door of the server: handles HTTPS and forwards requests to the right app | Caddyfile |
| **TLS/HTTPS** | Encryption between browser and server | Let's Encrypt via Caddy |
| **Environment variables** | Settings/secrets given to the app at start, not stored in code | §31 |
| **CI/CD** | Robots (GitHub Actions) that test every change and deploy it | `.github/workflows` |
| **Staging** | A copy of production with fake data for testing before release | |
| **Backup / restore / RPO / RTO** | Copy of data; bringing it back; how much data you may lose / how long recovery may take | §13.6 |
| **Idempotent** | Doing the same request twice has the same effect as once (important for payments and events) | `batch_id`, payment txn ids |
| **Webhook / callback** | A provider (Payme/Click) calls *your* server to report a payment | `/billing/payme` |
| **OpenAPI** | A machine‑readable description of the API, auto‑generated by FastAPI at `/docs` | generates TS client |
| **Rate limiting** | Limiting how many requests a user/IP can make per minute | auth, AI |
| **Logs / monitoring** | Records of what happened; dashboards and alerts to know when something breaks | §27 |

**Suggested learning path while building:** (1) run the backend locally with Docker Compose and open `http://localhost:8000/docs`; (2) read one module end to end (`children`: models → repository → service → router → tests); (3) write one small endpoint with a test; (4) create one Alembic migration; (5) deploy staging with Compose; (6) practice backup + restore; (7) read `modules/adaptive` with its README.

---

## Appendix B — Current endpoint inventory (as of 2026‑09‑28)

`/auth`: register, login, refresh, logout, oauth, forgot-password, reset-password, verify-email (legacy; not accepted by `get_current_user` today) · `/users`: GET/PATCH me · `/children`: consent-text, POST/GET, PATCH `{id}`, POST `{id}/session`, POST `{id}/consent` · `/curriculum`: levels, levels/{slug}/lessons, lessons/{id}, next · `/sessions`: POST, PATCH `{id}`, POST `{id}/events` · `/adaptive`: GET profile · `/progress`: skills, timeseries, adaptations, GET/PUT sync · `/rewards`: wallet, catalog, earn, `{id}`/redeem · `/parent`: children/{id}/summary, reports, children/{id}/export, DELETE children/{id} · `/teacher`: classes (POST/GET), classes/join, classes/{id}/assignments (POST/GET), classes/{id}/analytics · `/admin`: users, audit-logs, feature-flags (GET/PUT), curriculum/rollback, analytics · `/ai-assistant`: chat, conversations, conversations/{id} · `/aac`: events, compose, tts, insights, stats · `/notifications`: GET, PUT preferences · `/media`: upload.

## Appendix C — Current table inventory

`aac_events, adaptation_changes, adaptation_profiles, ai_conversations, ai_messages, assets, assignment_status, assignments, audit_logs, child_game_progress, children, class_enrollments, classes, curriculum_versions, daily_activity, feature_flags, interaction_events, item_localizations, items, learning_sessions, lessons, level_progress, levels, notification_preferences, notifications, oauth_identities, parental_consents, refresh_tokens, repetition_queue, reports, reward_definitions, reward_grants, skill_mastery, users, wallets` (Alembic 0001, 0002, 0004, 0005, 0006). Supabase (to be migrated): `auth.users`, `public.children`, `public.child_task_progress`.
