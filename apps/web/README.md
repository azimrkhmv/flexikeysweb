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

The FastAPI backend lives in another repository. This app does not call it yet:

- **`src/lib/api/` is an in-browser mock of the API**, split by domain (`auth`, `children`, `play`, `care`, `teacher`, `ai`, `billing`, `admin`, plus `schema`, `seed`, `db`, `selectors`, `guards`). Its data is stored in `localStorage` under the key `fk_db_v1`. Every mutation has a comment naming the endpoint it stands for (PRD §14). Pages read data only through the `sel.*` selectors (a test enforces it). Authorization rules (`sel.access`, the same logic as `can_access_child`, PRD §15.4), consent checks, server-side rewards, session ownership and billing idempotency all run inside `src/lib/api/`. Components never make these decisions.
- The **adaptive engine** is mirrored client-side in `src/lib/adaptive.ts`. It uses per-session metrics, BKT and a bounded policy. The policy changes each value by at most one step per session, and each rule has a matching rule that reduces help again. Hysteresis expires, which fixes the B5 ratchet. Tests are in `adaptive.test.ts`.
- **Audio:** the app uses on-device `speechSynthesis`, and only local voices, so no text leaves the device. This stands in for the pre-generated Azure audio manifest. Sound effects are Web Audio tones. The app never calls Google Translate TTS.
- **The AI assistant and teacher helper are rule-based stubs.** They use only aggregated data with no names, need consent and have a daily quota.
- **Payme and Click checkout is simulated.** An order is created, the provider callback is faked, and then the entitlement is granted.

To connect the real backend, replace the body of each `api.*` function with a `fetch("/api/v1/...")` call (cookie auth + CSRF header). Then swap `useDb()` reads for TanStack Query hooks. Both changes stay inside `src/lib/api/`.

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
- Levels unlock by mastery. Locked levels appear as "sleeping clouds", not padlocks.
- Teacher and therapist assignments point the way but never unlock a level (FR-CUR-4). `sel.lockReason` is the
  single gate: the child's map, the API (`completeActivity` rejects locked levels) and the parent, teacher and
  therapist views all use it. Adults see why an assigned level is still closed ("Opens after … is finished",
  "Needs the Family plan"); the child sees a sleeping cloud and hears a gentle line.

## Security headers

Defined in `security-headers.ts` and applied to every response by `next.config.ts`:

| Header | Value / purpose |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; scripts, styles, fonts, images, media and `connect-src` only from this origin — no third-party scripts, analytics or ads. `object-src 'none'` (no plugins), `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (no framing). |
| `X-Frame-Options: DENY` | Framing protection for browsers that ignore `frame-ancestors`. |
| `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | Standard hardening. |
| `Permissions-Policy` | Camera, microphone, geolocation and payment off everywhere; microphone allowed only under `/parent` (AAC card recording). |

**Decision (2026-09-29):** the policy is static and allows `'unsafe-inline'` scripts (needed by Next's inline bootstrap).
Per-request nonces were rejected because in Next 16 they force dynamic rendering of every page, and the public
`/uz /ru /en` pages must stay statically generated. Experimental hash-based SRI is not used yet. `'unsafe-eval'` is
added only in development. HSTS and TLS belong to the reverse proxy (PRD SEC-2).

Checked by `security-headers.test.ts` (policy contents) and `e2e/security.e2e.ts` (headers on static, app and child
pages; framing blocked; an injected third-party script and an outside `fetch` are refused).

## Deploy

`next.config.ts` builds a standalone server. From `apps/web`:

```bash
docker build -t flexikeys-web --build-arg NEXT_PUBLIC_SITE_URL=https://flexikeys.uz .
docker run -p 3000:3000 flexikeys-web
```

Settings are listed in `.env.example`. `/dev/design` is only included in production builds with `FK_DEV_PAGES=1`.
