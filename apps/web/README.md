# FlexiKeys Web

Next.js 16 web app for FlexiKeys, built from `../../PRD.md`, the design board and — where they disagree — the
product spec of 6 October 2026 (`../../docs/product-spec-2026-10-06.pdf`). It covers the marketing site, phone sign-in,
the parent intake and 4-week exercise roadmap, the physio video review queue, child play mode, AAC, parents,
therapists and admins. The pre-spec features (teachers, classes, email sign-in) are deleted (Q7).

## Run

Requires Node 22 (see `.github/workflows/ci-web.yml`).

```bash
npm install
npm run dev        # http://localhost:3000  (redirects to /uz, /ru or /en)
npm test           # vitest: adaptive policy, press timing, store, selectors, i18n parity + per-area coverage,
                   #         token contrast (WCAG AA), Emoji ≤12, architecture rule, proxy language pick
npm run typecheck  # generates Next route types first, then tsc
npm run lint
npx playwright install chromium   # once
npm run e2e        # Playwright against a production build: core flows, parent gate, axe, SEO, dashboard snapshots
```

Dashboard text snapshots live in `e2e/__snapshots__`. After an intended copy or data change, review the diff and run
`npx playwright test dashboards --update-snapshots`.

### Demo accounts

Sign-in is phone + SMS code. In the demo no SMS is sent: the code is shown on screen, and the demo buttons on
`/login` sign in at once.

| Role | Phone |
|---|---|
| Parent (2 children: Ali with a finished intake and roadmap, Madina) | +998 90 000 00 01 |
| Therapist (linked to Ali) | +998 90 000 00 02 |
| Video reviewer (physiotherapist, `/physio`) | +998 90 000 00 03 |
| Admin | +998 90 000 00 04 |

You can reset all demo data from **Admin → Support**.

### Product spec (2026-10-06) — what is built

- **Sign-up** (`/signup`, `src/features/auth/PhoneFlow.tsx`): language first (Uzbek Latin, Uzbek Cyrillic, Russian,
  English), phone + SMS code (WebOTP autofill on Android), basic consent, city and district (`src/content/districts.ts`).
  Uzbek Cyrillic is transliterated from the Uzbek catalog (`src/lib/cyrillic.ts`); content stays in uz/ru/en.
- **Parent intake P1–P41** (`/parent/children/new`, questions as data in `src/content/intake.ts`): saved as you go,
  "Not sure" stored as `null`, health consent gate (declined = games only), 3-month re-intake pre-filled.
- **Video library + physio review** (`/physio`, `src/content/exercises.ts`): only approved language versions reach a roadmap.
- **Roadmap engine** (`src/lib/roadmap.ts`, tests in `roadmap.test.ts`): deterministic rules, safety filters that are
  tested over every restriction / seizure / surgery / movement-level combination, 4 weeks, daily count from P34.

## What is real and what is mocked

The FastAPI backend lives in another repository. By default (`NEXT_PUBLIC_API_MODE=mock`) the app runs on an
in-browser mock of it; `NEXT_PUBLIC_API_MODE=live` connects every area to the real API
(see **Live mode** below). In mock mode:

- **`src/lib/api/` is an in-browser mock of the API**, split by domain (`auth`, `children`, `intake`, `play`, `care`, `ai`, `billing`, `admin`, plus `schema`, `seed`, `db`, `selectors`, `guards`). Its data is stored in `localStorage` under the key `fk_db_v1`. Every mutation has a comment naming the endpoint it stands for (PRD §14). Pages read data only through the `sel.*` selectors (a test enforces it). Authorization rules (`sel.access`, the same logic as `can_access_child`, PRD §15.4), consent checks, server-side rewards, session ownership and billing idempotency all run inside `src/lib/api/`. Components never make these decisions.
- The **adaptive engine** is mirrored client-side in `src/lib/adaptive.ts`. It uses per-session metrics, BKT and a bounded policy. The policy changes each value by at most one step per session, and each rule has a matching rule that reduces help again. Hysteresis expires, which fixes the B5 ratchet. Tests are in `adaptive.test.ts`.
- **Audio:** the app uses on-device `speechSynthesis`, and only local voices, so no text leaves the device. This stands in for the pre-generated Azure audio manifest. Sound effects are Web Audio tones. The app never calls Google Translate TTS.
- **The AI assistant is a rule-based stub.** They use only aggregated data with no names, need consent and have a daily quota.
- **Payme and Click checkout is simulated.** An order is created, the provider callback is faked, and then the entitlement is granted.


## Structure

```
src/app/[locale]      public site in /uz /ru /en: landing, pricing, privacy, terms (server-rendered, hreflang, sitemap)
src/proxy.ts          redirects /, /pricing, /privacy, /terms to the visitor's language
src/app/(auth)        phone sign-in and the details step after it
src/app/play          child mode: map, levels, activities, AAC "My Voice", cloud shop
src/app/parent        dashboard, child progress, "what changed and why", reports, AI assistant, billing, privacy
src/app/therapist     linked children, notes, goals, recommendations (reads are audited)
src/app/admin         users, subscriptions, content, flags, audit log, AI usage, support
src/app/demo          try-a-demo (stores nothing)
src/app/dev/design    design system gallery
src/content           curriculum (16 levels × en/uz/ru), vocabulary, AAC cards, shop items
src/features/play     child shell, PlayContext, <Target> (touch, hold, hover-dwell, scanning, keyboard)
src/features/activities  activity engines (5 archetypes + typing) and AdaptiveKeyboard
src/messages          i18n catalogs per area (en/uz/ru). Routes register only what they use: public.ts, child.ts, adult.ts
                      (lib/translate.ts). Tests fail on a missing key in any language or in an area's catalogs.
```

## Product rules enforced in code

- The child UI never shows a failure state. A miss gets a soft tone, a curious mascot and a gentle pulse on the right answer. The i18n test fails the build if failure words appear in child-facing copy.
- The server grants coins and stars. The client never sends amounts. Coins cannot be bought. A subscription opens more levels but never changes rewards.
- Parents see every adaptation change as a plain-language sentence. They cannot change the adaptation settings.
- Levels unlock by mastery. Locked levels appear as "sleeping clouds", not padlocks.
- Therapist recommendations point the way but never unlock a level (FR-CUR-4). `sel.lockReason` is the
  single gate: the child's map, the API (`completeActivity` rejects locked levels) and the parent and
  therapist views all use it. Adults see why an assigned level is still closed ("Opens after … is finished",
  "Needs the Family plan"); the child sees a sleeping cloud and hears a gentle line.

## Live mode (real server)

`NEXT_PUBLIC_API_MODE=live` (build time) switches the website to our own server in `../api` (FastAPI). The
browser calls `/api/v1` on its own origin; `next.config.ts` forwards it to `FK_API_ORIGIN` (default
`http://localhost:8000`); in production Caddy does this (`../../deploy/`). Files (videos, voice notes) go
straight between the browser and the file storage, so the security policy allows `FK_STORAGE_ORIGIN` (default
`http://localhost:9100`, the server's MinIO). Sign-in is
httpOnly cookies set by the server; writes carry the CSRF token. There is no demo data in live mode.

Connected to the server (every address is listed in `src/lib/server/types.ts`, typed from
`../api/openapi.json`, so a changed address fails `npm run typecheck`):

- **Accounts:** phone + SMS code sign-in, the details step, the admin's authenticator code, sign out
  everywhere, delete the account.
- **Parent:** children, consents, the questions (intake), the plan, Today (tasks done, pause, daily question),
  My Voice cards, sharing with a therapist (phone or link), clips, what the therapists changed, a second adult.
- **Therapist:** invites, shared children, the therapist form, clips and replies.
- **Video reviewer and admin:** the review queue, video upload, users.

Every other `api.*` call answers "not available" or still points at the old backend's addresses, which
`../api` does not have; `TASKS.md` lists the work that moves each one.

```bash
cd ../api && cp .env.example .env && docker compose up -d db redis minio && uv run alembic upgrade head
uv run uvicorn app.main:app --port 8000          # in ../api
NEXT_PUBLIC_API_MODE=live npm run dev            # here
```

`FK_API_ORIGIN`, `FK_STORAGE_ORIGIN` and `NEXT_PUBLIC_API_MODE` are read at **build** time: Next bakes the
rewrite and the security policy into `.next`. Changing them needs a rebuild.

**Consent:** no consent record means no consent. For a child without the basic consent, child mode doesn't start.
The parent sees why, and the Privacy tab offers **Give consent**.

### Live E2E (website + server + database)

With the server running as above, `npm run e2e:live` builds the website in live mode on port 3200 and runs
`e2e-live/` in Chromium (with a fake microphone). The demo SMS sender shows the code on screen, and the tests
read it from there. Start the server with `OTP_PER_IP_PER_HOUR=500`: every test signs in from the same address.

CI (`../../.github/workflows/e2e-live.yml`) does the same on every change to the server or the live connection,
and nightly, from an empty database.

Code: `src/lib/live/`: `http.ts` (client, refresh on 401, error codes), `map.ts` (server ↔ website shapes,
unit-tested), `db.ts` (TanStack Query reads shaped like the mock DB, so pages and `sel.*` don't change),
`api.ts` (writes). `src/content/levels.manifest.json` (`UPDATE_MANIFEST=1 npm test`) is what the old backend
gated levels on; `../api` doesn't use it yet.

## Security headers

Defined in `security-headers.ts` and applied to every response by `next.config.ts`:

| Header | Value / purpose |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; scripts, styles, fonts, images, media and `connect-src` only from this origin — no third-party scripts, analytics or ads. `object-src 'none'` (no plugins), `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (no framing). |
| `X-Frame-Options: DENY` | Framing protection for browsers that ignore `frame-ancestors`. |
| `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | Standard hardening. |
| `Permissions-Policy` | Camera, geolocation and payment off; microphone for our own origin only (parents record their voice for My Voice cards — it can't be limited to `/parent`, because the single-page app keeps the policy of the page it was first loaded on). |

**Decision (2026-09-29):** the policy is static and allows `'unsafe-inline'` scripts (needed by Next's inline bootstrap).
Per-request nonces were rejected because in Next 16 they force dynamic rendering of every page, and the public
`/uz /ru /en` pages must stay statically generated. Experimental hash-based SRI is not used yet. `'unsafe-eval'` is
added only in development. HSTS and TLS belong to the reverse proxy (PRD SEC-2).

Checked by `security-headers.test.ts` (policy contents) and `e2e/security.e2e.ts` (headers on static, app and child
pages; framing blocked; an injected third-party script and an outside `fetch` are refused).

## Deploy

`next.config.ts` builds a standalone server. From `apps/web`:

```bash
docker build -t flexikeys-web --build-arg NEXT_PUBLIC_SITE_URL=https://flexikeys.uz \
  --build-arg NEXT_PUBLIC_API_MODE=live .          # default: mock
docker run -p 3000:3000 flexikeys-web
```

In production the reverse proxy routes `/api/v1` to the API. If the web container should proxy it instead, pass
`--build-arg FK_API_ORIGIN=http://backend:8000`. It's a build-time setting.

Settings are listed in `.env.example`. `/dev/design` is only included in production builds with `FK_DEV_PAGES=1`.
