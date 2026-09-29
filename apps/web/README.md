# FlexiKeys Web

Next.js 16 web app for FlexiKeys, built from `../../PRD.md` and the design board. It covers the marketing site, auth, child play mode, AAC, parents, teachers, therapists and admins.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: adaptive policy, keyboard timing, i18n parity, banned words
npm run typecheck
npm run lint
```

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

- **`src/lib/api.ts` is an in-browser mock of the API.** Its data is stored in `localStorage` under the key `fk_db_v1`. Every mutation has a comment naming the endpoint it stands for (PRD §14). Authorization rules (`sel.access`, the same logic as `can_access_child`, PRD §15.4), consent checks, server-side rewards, session ownership and billing idempotency all run inside this file. Components never make these decisions.
- The **adaptive engine** is mirrored client-side in `src/lib/adaptive.ts`. It uses per-session metrics, BKT and a bounded policy. The policy changes each value by at most one step per session, and each rule has a matching rule that reduces help again. Hysteresis expires, which fixes the B5 ratchet. Tests are in `adaptive.test.ts`.
- **Audio:** the app uses on-device `speechSynthesis`, and only local voices, so no text leaves the device. This stands in for the pre-generated Azure audio manifest. Sound effects are Web Audio tones. The app never calls Google Translate TTS.
- **The AI assistant and teacher helper are rule-based stubs.** They use only aggregated data with no names, need consent and have a daily quota.
- **Payme and Click checkout is simulated.** An order is created, the provider callback is faked, and then the entitlement is granted.

To connect the real backend, replace the body of each `api.*` function with a `fetch("/api/v1/...")` call (cookie auth + CSRF header). Then swap `useDb()` reads for TanStack Query hooks. Both changes stay inside `src/lib/api.ts`.

## Structure

```
src/app/(marketing)   landing, pricing, privacy, terms
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
src/messages          i18n catalogs per area (en/uz/ru). A test fails if any key is missing.
```

## Product rules enforced in code

- The child UI never shows a failure state. A miss gets a soft tone, a curious mascot and a gentle pulse on the right answer. The i18n test fails the build if failure words appear in child-facing copy.
- The server grants coins and stars. The client never sends amounts. Coins cannot be bought. A subscription opens more levels but never changes rewards.
- Parents see every adaptation change as a plain-language sentence. They cannot change the adaptation settings.
- Levels unlock by mastery. Locked levels appear as "sleeping clouds", not padlocks.
