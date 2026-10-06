# FlexiKeys Web

Next.js 16 web app for FlexiKeys, built from `../../PRD.md` and the design board. It covers the marketing site, auth, child play mode, AAC, parents, teachers, therapists and admins.

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

All demo accounts use the password `demo12345`.

| Role | Email |
|---|---|
| Parent (2 children: Ali, Madina) | parent@demo.uz |
| Teacher (class code `KQ7M4P`) | teacher@demo.uz |
| Therapist (linked to Ali) | therapist@demo.uz |
| Admin | admin@demo.uz |

Class login for children: `/class`, then enter code `KQ7M4P`. You can reset all demo data from **Admin → Support**.

## What is real and what is mocked

The FastAPI backend lives in another repository. By default (`NEXT_PUBLIC_API_MODE=mock`) the app runs on an
in-browser mock of it; `NEXT_PUBLIC_API_MODE=live` connects every area to the real API
(see **Live mode** below). In mock mode:

- **`src/lib/api/` is an in-browser mock of the API**, split by domain (`auth`, `children`, `play`, `care`, `teacher`, `ai`, `billing`, `admin`, plus `schema`, `seed`, `db`, `selectors`, `guards`). Its data is stored in `localStorage` under the key `fk_db_v1`. Every mutation has a comment naming the endpoint it stands for (PRD §14). Pages read data only through the `sel.*` selectors (a test enforces it). Authorization rules (`sel.access`, the same logic as `can_access_child`, PRD §15.4), consent checks, server-side rewards, session ownership and billing idempotency all run inside `src/lib/api/`. Components never make these decisions.
- The **adaptive engine** is mirrored client-side in `src/lib/adaptive.ts`. It uses per-session metrics, BKT and a bounded policy. The policy changes each value by at most one step per session, and each rule has a matching rule that reduces help again. Hysteresis expires, which fixes the B5 ratchet. Tests are in `adaptive.test.ts`.
- **Audio:** the app uses on-device `speechSynthesis`, and only local voices, so no text leaves the device. This stands in for the pre-generated Azure audio manifest. Sound effects are Web Audio tones. The app never calls Google Translate TTS.
- **The AI assistant and teacher helper are rule-based stubs.** They use only aggregated data with no names, need consent and have a daily quota.
- **Payme and Click checkout is simulated.** An order is created, the provider callback is faked, and then the entitlement is granted.


## Structure

```
src/app/[locale]      public site in /uz /ru /en: landing, pricing, privacy, terms (server-rendered, hreflang, sitemap)
src/proxy.ts          redirects /, /pricing, /privacy, /terms to the visitor's language
src/app/(auth)        login, signup, verify-email, forgot/reset password
src/app/class         class-code login for school devices
src/app/play          child mode: map, levels, activities, AAC "My Voice", cloud shop
src/app/parent        dashboard, child progress, "what changed and why", reports, AI assistant, billing, privacy
src/app/teacher       classes, QR poster, roster, heatmap, assignments, AI helper
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
- Levels are independent: the child picks any level they have access to, in any order, and can replay finished
  ones. A level is done when its required activities are done (`levelComplete`), whatever order they came in.
  The map shows each level as new, started (progress dots) or finished (⭐), plus "finished / playable" overall.
- The only lock is access: paid levels need the Family plan (or a school/therapist link). `sel.lockReason` is the
  single gate: the child's map, the API (`completeActivity` rejects locked levels) and the parent, teacher and
  therapist views all use it. Adults see "Needs the Family plan"; the child sees a sleeping cloud and hears a
  gentle line. Teacher and therapist assignments never open a locked level.

## Live mode (real backend)

`NEXT_PUBLIC_API_MODE=live` (build time) switches the connected areas to the FastAPI backend
(`Shoxjahon001/flexikeys`, branch `web-backend`). The browser calls `/api/v1` on its own origin;
`next.config.ts` forwards it to `FK_API_ORIGIN` (default `http://localhost:8000`) — in production the
reverse proxy does this. Auth is httpOnly cookies set by the API; writes carry the CSRF token.

Every area is connected; there is no demo data in live mode:

- **Accounts:** email + password sign-up for parents, teachers and therapists (teachers/therapists wait for
  admin approval), email verification, password reset, `/me` (change password, sign out everywhere, delete).
- **Parent:** children with consent, settings, consents, export, delete; progress, "what changed",
  reports (print to PDF), sharing with a class or a therapist, notification bell and preferences, billing.
- **Child mode:** sessions, events, server-granted rewards, the mastery and plan gates, adaptive profile,
  cloud shop, drawing activities, AAC (core + the parent's own cards with photo and recorded voice).
- **Teacher:** classes, class codes + class login on a shared device, assignments, roster progress.
- **Therapist:** invites, care links, notes and goals (reads are audited).
- **Assistant:** the parent/teacher assistant (built-in rule-based summary when the server has no LLM key).
- **Admin:** users and approvals, subscriptions and orders, complimentary access, support actions,
  overview with service health; changes need a password re-check (15 min) and are audited.

External setup still needed (server side, not in this repo): Google sign-in client ID, SMTP provider,
Payme/Click merchant credentials, an LLM key, pre-generated Azure audio, and cron for the weekly reports
and the deleted-account purge (see the backend README).

**Consent:** no consent record means no consent. For a profile without core consent, e.g. one mirrored from the
mobile app, child mode doesn't start. The parent sees why, and the Privacy tab offers **Give consent**. The server
stores nothing for such a child (backend `docs/consent-compatibility.md`).

```bash
# backend: cd flexikeys/infra && docker compose up -d   (API on :8000)
NEXT_PUBLIC_API_MODE=live npm run dev
```

`FK_API_ORIGIN` and `NEXT_PUBLIC_API_MODE` are read at **build** time: Next bakes the `/api/v1` rewrite into
`.next`. Changing them needs a rebuild.

### Live E2E (web + API + database)

`e2e-live/compose.yml` starts a throwaway stack: an empty in-memory Postgres, Redis, Mailpit (catches the
verification / reset emails), MinIO (private media bucket) and a backend **image**, with only the API published
on `127.0.0.1:58000`. Payme/Click use test credentials local to the stack. Chromium gets a fake microphone. CI uses the same file.

```bash
export BACKEND_IMAGE=$(cat e2e-live/backend.image)   # or a local build: docker build -t flexikeys-backend:local ../flexikeys/backend
export E2E_SECRET_KEY=$(openssl rand -hex 32)
docker compose -f e2e-live/compose.yml up -d --wait
FK_API_ORIGIN=http://localhost:58000 npm run e2e:live
docker compose -f e2e-live/compose.yml down
```

CI (`.github/workflows/e2e-live.yml`) pulls the **private** image pinned by digest in `e2e-live/backend.image`
(never `latest`) with the job's own `GITHUB_TOKEN`. One-time setup:
1. Put both repos in one GitHub organization.
2. On the backend package (`ghcr.io/<org>/flexikeys/backend`), go to Package settings → Manage Actions access and add this repo with **Read**.
3. Paste a digest from the backend's "Backend image" workflow summary into `e2e-live/backend.image`.

Until step 3 the job is skipped with a warning.

Code: `src/lib/live/` — `http.ts` (client, refresh on 401, error codes), `map.ts` (backend ↔ web
shapes, unit-tested), `db.ts` (TanStack Query reads shaped like the mock DB so pages and `sel.*` are
unchanged), `api.ts` (writes). The level manifest the server gates on is `src/content/levels.manifest.json`
(`UPDATE_MANIFEST=1 npm test` regenerates it; copy it to the backend's `flexikeys/content/`).

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
