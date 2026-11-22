# FlexiKeys — Update 4: ready for the parents' event, white-warm look, UI libraries (Bekzod, 22 Nov 2026)

You are working in the `flexikeysweb` repository. Read `CLAUDE.md` first and follow its rules (work on `main`, pull
first, commit prefixes, tests green before push, never edit a pushed migration).

**Why this update.** The team is holding an event for 50+ parents in the next one or two weeks, hosted with a rehab
center. On that day parents will open flexikeys.org on their own phones, sign up, fill in the questionnaire and get a
plan. Today there is no live server. This file lists everything the code still needs before that day, then the new
white-warm look and the UI libraries.

Every point below already has a decision. Do not ask again; build what is written. If something is impossible without
breaking a product rule in `CLAUDE.md`, stop and write `- BLOCKED: <why>` under the task in `TASKS.md`.

---

## 0. Before you start

1. **Record these decisions** in `TASKS.md` section 3 ("Decisions already made"), dated 22 Nov 2026, by Bekzod:
   - **Launch first.** Deployment, trust, tracking and the offer (tasks 1–5) come before the look and the libraries.
   - **White-warm is the new Warm Hills light.** The page is white with a slight warm orange/yellow tone. It replaces
     the 19 Nov Warm Hills light values everywhere (landing page and every page that uses Warm Hills light). Warm
     Hills dark and the other five schemes do not change.
   - **The landing page is always Warm Hills light, Soft.** It ignores device dark mode and saved appearance choices.
   - **New UI libraries are allowed, but only these five:** Sonner (toasts), Vaul (drawers / bottom sheets),
     NumberFlow (animated numbers), Base UI (accessible primitives) and **one** Magic UI effect (copied source, on the
     landing page only). This replaces the "No new packages" rule of the 19 Nov file for these five only. Any other
     package still needs Bekzod's yes. `motion` (framer-motion) is already in the repo and stays.
   - **The child picture on the landing page is not part of this update.** The team is still choosing its design. Do
     not add or draw a child.
2. **Add these questions** to `TASKS.md` section 6, with the next free `Q` numbers:
   - "Final price and free period? (Free month, then 299,000 UZS per 3 months until answered.)"
   - "What happens when the free month ends and a family has not paid? (Only a gentle reminder to the parent until
     answered; the child is never locked out.)"
   - "Has a lawyer or award mentor checked the privacy policy and the database registration question?"
3. **Add the tasks** in section 9 to `TASKS.md` section 5 as a new group "Update 4 (22 Nov 2026)", owner Bekzod,
   with the next free `B` numbers, each with its Done when / Needs lines.
4. Work through them in order, one commit per task.

## 1. Rules for every change in this file

- **Product rules stay.** No diagnosis. The child never sees a number. Child screens have no timer, no red, no X and
  no failure sound.
- **Mock mode and live mode both work.** The Vercel demo (`demo.flexikeys.org`) runs in mock mode with no server.
- **Every text people see in `en`, `ru`, `uz`.** Write `uz` (Latin) yourself where this file gives only `en`, and mark
  it `"uz text drafted 22 Nov 2026 — native-speaker check (B44)"`.
- **Colours only from tokens.** The 19 Nov no-raw-colour test and contrast test must stay green. Library styles are
  set through token classes, never with the library's own colours.
- **Animation:** only `transform` and `opacity`. Reduced motion turns off every animation added in this file.
- **Accessibility:** every new control works with the keyboard and has a visible focus ring; panels close with
  Escape and return focus to the button that opened them.
- **Phones first.** Parents will use cheap Android phones on mobile data. Check every task at 360 px width.

---

## 2. Production deployment files (task 1)

There is no live server yet. Build the files now so Bekzod can deploy as soon as the server is rented. The plan:
one Linux server in Tashkent, Docker Compose, Caddy for HTTPS. Real children's data stays in Uzbekistan. The Vercel
demo stays in mock mode at `demo.flexikeys.org`.

Read `CLAUDE.md`, `deploy/Caddyfile`, `apps/api/compose.yaml`, both `.env.example` files and the dev readme first;
reuse what exists.

1. `deploy/compose.prod.yml` with services `caddy`, `web` (Next.js production build of `apps/web`, **live mode**, not
   mock), `api` (`apps/api`), `postgres`, `redis`, `minio`. **Only `caddy` publishes ports (80, 443)**: a published
   port goes around the server firewall, so the others must have no `ports:` line. Named volumes for Postgres, MinIO
   and Caddy data. `restart: unless-stopped` on all. Health checks for postgres and api. Dockerfiles for web and api
   if they do not exist (multi-stage, non-root user; Next.js `output: "standalone"`).
2. `deploy/Caddyfile`: `flexikeys.org` → web; `www.flexikeys.org` → redirect to `flexikeys.org`;
   `api.flexikeys.org` → api; `files.flexikeys.org` → minio (S3 port). Security headers stay as in
   `security-headers.ts`. Upload limit 500 MB on `files.` (exercise videos).
3. `deploy/.env.prod.example`: every variable production needs, one-line comment each, no real values. Must include
   `S3_PUBLIC_ENDPOINT=https://files.flexikeys.org`, `FK_STORAGE_ORIGIN=https://files.flexikeys.org`, the API URL the
   website uses (`https://api.flexikeys.org`), API CORS origins (`https://flexikeys.org` only), database and MinIO
   passwords, the app's secret keys, and the new `NEXT_PUBLIC_SUPPORT_URL` (task 4).
4. MinIO bucket set-up on first start: bucket private; CORS allows `PUT` and `GET` from `https://flexikeys.org`. This
   fixes the 1 Nov phone upload bug.
5. `deploy/deploy.sh`: `git pull`, build, `alembic upgrade head` once, `up -d`, then print the api health check. Stops
   at the first error.
6. `deploy/backup.sh`: gzipped `pg_dump` and a copy of the MinIO bucket into `~/backups/<date>/`, keeps 14 days, and
   copies the folder to a second machine given by `BACKUP_TARGET` (rsync over SSH). `deploy/restore.sh` restores a
   given date into a **fresh** database for testing.
7. `deploy/README.md`: first start, update, roll back to the previous commit, read logs, restore a backup.
8. Mock mode on Vercel still builds and works unchanged.

Prove it before pushing: `docker compose -f deploy/compose.prod.yml config`, then a full local start with `localhost`
names; sign up, upload a photo, play a game.

## 3. Trust: privacy policy and consent (task 2)

Parents are trusting an app with their child's health data. They must be able to read what is stored.

- A **Privacy** page at `/privacy` in `en`, `ru`, `uz`. Write it from what the code **really** stores: go through the
  database models and the browser storage, and list each kind of data, where it lives, who can see it and how long it
  is kept. Say plainly that the data is stored on a server in Uzbekistan. Mark the page at the top (visible only in
  mock mode and to admins) "Draft 22 Nov 2026 — needs lawyer/mentor check", and link the new `Q` question.
- Link it from the landing page footer, the sign-up screen and every consent screen.
- **Sign-up consent:** if sign-up has no consent checkbox yet, add one: "I agree to the Privacy policy" with the link.
  Sign-up cannot finish without it. Store the date and the policy version with the account.
- **Check, don't build:** the health-data consent (exists since the Feedback fixes), video consent, therapist-share
  consent, and the parent controls (see the data, download it, delete the child profile). For each one that is
  missing, add a line to `TASKS.md` with the next `B` number. Do not build them in this update.

## 4. Sign-up tracking and the pilot numbers page (task 3)

Demo Day needs registrations by region and proof of reach through centers. The team also needs to call families who
go quiet.

### 4.1 Region at sign-up
- If sign-up does not ask for a region, add a required select with the 14 regions: Tashkent city, Tashkent region,
  Andijan, Bukhara, Fergana, Jizzakh, Kashkadarya, Khorezm, Namangan, Navoi, Samarkand, Surkhandarya, Syrdarya,
  Republic of Karakalpakstan (names in all three languages). Existing accounts without a region are asked once, on
  their next visit, with a "Skip" option.

### 4.2 Center links (`ref`)
- Admin can create a **center link**: center name + short code (for example `dvijeniye`). The link is
  `https://flexikeys.org/?ref=<code>`.
- When a visitor opens any page with `?ref=`, store the code on the device (`localStorage`, try/catch, kept 30 days).
  At sign-up, save it on the parent account (first code wins; never overwritten later). Unknown codes are ignored.
- The admin list shows each link and a copy button. No QR code library: the team makes QR codes from the link.

### 4.3 Pilot numbers (admin only)
A page **Pilot numbers** for admins with:
- sign-ups per day, per region and per center link (and "no link");
- **retained families**, by the 2.3 definition: a family that finishes at least one exercise or game on at least
  3 days a week, in at least 3 of every 4 weeks. Show the count and the share of families that finished sign-up;
- **quiet families**: finished sign-up, no finished exercise or game in the last 3 days. Show parent name, the contact
  the account has (phone or email), region, center link and last active date, so the team can call them;
- a CSV download of each table.
Count from the saved exercise and game records (date + family), never from parents' answers. Tests for the retained
and quiet rules with fixed dates.

## 5. The offer, manual payments and the help button (task 4)

### 5.1 Offer
- One config file (`apps/web/src/content/offer.ts`, and the same values on the server if the server needs them):
  free period 30 days from the end of sign-up, then 299,000 UZS per 3 months. Values change in this file only.
- Show the offer in one short line on the landing page (near the main button) and in Account → Plan, with the date
  the free month ends for this family.
- When the free month has ended and the family is not marked paid, show the parent a gentle reminder in Account and
  on Overview. **Never** lock the child out and never show anything about payment on child screens.

### 5.2 Manual payments (no payment provider yet)
- Admin can mark a family as **paid**: amount (UZS), method (free text: Payme, Click, card transfer, cash), paid
  until (date), note. Keep a list of payments per family.
- Pilot numbers (4.3) shows total revenue received and the number of paying families.

### 5.3 Help button
- A **Help** button in the parent header that opens `NEXT_PUBLIC_SUPPORT_URL` (the team's Telegram) in a new tab. If
  the variable is empty, the button is hidden. Not on child screens.

## 6. Only approved exercises go live (task 5)

Every exercise must be signed off by a specialist before parents see it (Task 1 plan).
- In live mode, parents and children see only exercises marked approved in admin. Mock mode is unchanged.
- An approved exercise shows a small line "Checked by a specialist" (ru «Проверено специалистом»).
- Test: an unapproved exercise never reaches a parent in live mode, through the plan, the exercise list or the API.

## 7. White-warm Warm Hills light (task 6)

### 7.1 New values
Replace these tokens in **Warm Hills light** only. All other tokens of Warm Hills light keep their 19 Nov values.
Warm Hills dark and the other schemes do not change.

| Token | New value | Note |
|---|---|---|
| `sky1` | `#FFFFFF` | top of the page: white |
| `sky2` | `#FFF7EA` | bottom of the page: white with a warm tone |
| `paper` | `rgba(255, 255, 255, 0.86)` | Soft cards |
| `paperSolid` | `#FFFFFF` | |
| `ink` | `#3D2A1C` | 13.6:1 on white |
| `muted` | `#6E5A47` | 6.5:1 on white |
| `accent` | `#F29A4A` | warm orange fills |
| `accentText` | `#A8521C` | 5.4:1 on white |
| `btnA` → `btnB` | `#FFC47E` → `#F49B4B` | main button |
| `btnText` | `#3D2A1C` | 8.7:1 / 6.2:1 on the button |
| `line` | `#F0DFC4` | |
| `sun` / `sunGlow` | `#FFD36E` / `#FFE9B8` | |
| `hillFar` / `hill1` / `hill2` | `#FCE9CC` / `#F8D9A8` / `#F4C68A` | paler hills, so the page reads as white |
| `cloud` | `#FCEBD3` | drifting clouds must still show on white |

- The contrast values above are measured; the 19 Nov contrast test must pass for Warm Hills light with them. If
  `gameEdge` on `sky2` drops under 3:1, darken `gameEdge` until it passes and write the value in the task note.
- Check by eye that Cloudy, the drifting clouds and the hills are still visible on the white page in Soft and Sharp.
  If Cloudy's body disappears against white, give `cloudyBody` a slight warm tint (no darker than `#FFF3E0`) and note
  it.

### 7.2 Landing page
- Force `data-scheme="warm-hills"`, light mode and `data-style="soft"` on the landing page, whatever the device or the
  saved choice says. Leaving the landing page restores the parent's own choice.
- No content changes except the offer line (5.1) and the footer link (3). No child picture (decision 0.1).
- Screenshots of the landing page, Overview, the questionnaire and one game in Warm Hills light, Soft and Sharp, at
  360 px and 1366 px, in the task note.

## 8. UI libraries (tasks 7–9)

### 8.1 Set-up and the CLAUDE.md rule (task 7)
- Install `sonner`, `vaul`, `@number-flow/react`, and Base UI. For Base UI, use the package name on the quick-start
  page of base-ui.com (it was `@base-ui-components/react`; it may now be `@base-ui/react`). Pin exact versions.
- Add a short **"UI libraries"** section to `CLAUDE.md`, so later tasks reuse them instead of building by hand:

  | Need | Use |
  |---|---|
  | Dialogs, popovers, menus, selects, switches, tabs, tooltips | Base UI |
  | Toasts | Sonner |
  | Drawers / bottom sheets on phones | Vaul |
  | Numbers that change (parent pages only) | NumberFlow |
  | Springs, layout and enter/exit animation | motion (already installed) |
  | A simple hover or fade | plain CSS transition |

  Add: "Style every library through theme tokens. The child never sees a number, so NumberFlow is never used on child
  screens. One standout animation per page; on the landing page that is Cloudy plus the single Magic UI effect."

### 8.2 Use them where they help (task 8)
Replace hand-made versions; do not change what the screens do.

- **Base UI** — every hand-made dialog, popover, dropdown, select, switch and tab set on parent pages, in the
  questionnaire, in Account → Appearance and in admin. Keep the current look (Soft/Sharp, tokens). Base UI handles
  focus trapping, Escape, outside click and screen-reader labels, so remove the hand-written versions of these.
  **Child screens:** use Base UI only where it still works with all four input modes (touch, hold-to-choose, switch
  scanning, keyboard) and the child's `min_target_mm`. If it does not, keep the current child control and note why.
- **Sonner** — every toast or short message on parent pages: saved, uploaded, copied, sign-in errors, "You are
  offline — your answers are kept on this phone", "Back online — saved". Use `unstyled` with token classes; error
  toasts use `accentText` and an icon, not red. Bottom-centre on phones, bottom-right on laptops. Texts in the
  parent's language. **No toasts on child screens.**
- **Vaul** — on phones (under 768 px), panels that today open as a centred box become bottom sheets: Account →
  Appearance, exercise details, and the child's **My colours** sheet. On laptops keep the Base UI dialog.
  For every child sheet set `dismissible={false}`: children with motor difficulties drag by accident, so a child sheet
  closes only with its large **Done** button. Parent sheets may close by dragging down, and always also have a close
  button.
- **NumberFlow** — numbers that change on parent pages: progress panel scores, active days this week, minutes played,
  and the pilot numbers page. Never on child screens; add a test that no child route imports NumberFlow. Reduced
  motion: numbers change without animation.
- **motion** — where code animates enter/exit or layout by hand (Cloudy tour cards, plan cards appearing, sheet
  content), use `motion` with the existing `transform`/`opacity` rule. Do not rewrite Cloudy's movement if it already
  works.

### 8.3 One Magic UI effect on the landing page (task 9)
Cloudy already moves around the page, so the second effect must stay quiet.
- Use Magic UI's **Shine Border** around the landing page's main button ("Start" / its current label). Copy the
  component's source from magicui.design into `apps/web/src/components/effects/` (MIT licence; keep the licence note
  in a comment). Do not run `shadcn init` and do not add a `components.json`.
- Colours from `sun` and `accent` tokens only. One slow shine every few seconds, not a fast loop. Off with reduced
  motion and off when "Cloudy moves" is off. Load it lazily so it does not slow the first paint.
- Nowhere else in the app.

## 9. Phones, weak internet and 50 parents at once (task 10)

Do this last, after the libraries, because they add weight.

- **Speed on a cheap phone.** Run Lighthouse in mobile mode (its default slow 4G phone) on the landing page, sign-up
  and the first questionnaire step. Target: performance 85 or more, largest paint under 2.5 s. Write the numbers
  before and after this update in the task note. Lazy-load the games, NumberFlow and the Magic UI effect.
- **Weak internet.** With the browser set to offline halfway through the questionnaire: no answer is lost, the parent
  sees the Sonner offline message, and answers are sent when the connection returns. Fix it if not.
- **Load test.** `deploy/loadtest.mjs` (Node's built-in `fetch`, no new package): 50 virtual parents at the same time
  each sign up (`loadtest+<n>@flexikeys.test`), answer the quick start, open the plan and save one game record. Print
  errors and p50/p95 time per step. Pass: 0 errors and p95 under 2 s for every API call.
  - If sign-up needs an SMS or email code, add a bypass that works **only** when `FK_LOADTEST_SECRET` is set on the
    server and the email ends with `@flexikeys.test`. It is off by default and listed in `deploy/README.md` with a
    warning to unset it after the test.
  - `deploy/loadtest-cleanup.mjs` deletes every `@flexikeys.test` account and its data.
  - It runs against the local production stack by default. Against `flexikeys.org` it refuses to run without
    `--production`.

## 10. Tasks to add to TASKS.md (in this order)

1. **Production deployment files** (section 2)
   - Done when: all files exist; `compose config` passes; a local production start works (sign-up, upload, game);
     only Caddy publishes ports; mock mode on Vercel unchanged.
   - Needs: —
2. **Privacy page and sign-up consent** (section 3)
   - Done when: `/privacy` in three languages matches what is really stored; linked from landing, sign-up and consent
     screens; sign-up needs the checkbox; missing consents and parent controls are listed in `TASKS.md`.
   - Needs: —
3. **Region, center links and pilot numbers** (section 4)
   - Done when: region is asked; `ref` is saved at sign-up; the admin page shows sign-ups, retained and quiet families
     with CSV downloads; rule tests pass.
   - Needs: task 2
4. **Offer, manual payments, Help button** (section 5)
   - Done when: the offer comes from one file and shows on landing and Account; reminders never touch child screens;
     admin records payments and revenue shows on pilot numbers; Help opens the support link or is hidden.
   - Needs: task 3
5. **Only approved exercises in live mode** (section 6)
   - Done when: the test proves an unapproved exercise never reaches a parent in live mode.
   - Needs: —
6. **White-warm Warm Hills light** (section 7)
   - Done when: new values in place; contrast test green; landing forced to Warm Hills light Soft; screenshots in the
     note.
   - Needs: —
7. **UI libraries set-up and CLAUDE.md rule** (section 8.1)
   - Done when: the four packages are installed at pinned versions; the CLAUDE.md section exists.
   - Needs: —
8. **Use the libraries** (section 8.2)
   - Done when: hand-made dialogs, toasts, sheets and changing numbers are replaced as described; child sheets close
     only with Done; no NumberFlow or toast on child screens (test); all four child input modes still work.
   - Needs: task 7
9. **Shine Border on the landing button** (section 8.3)
   - Done when: one quiet effect, token colours, off with reduced motion and with "Cloudy moves" off, lazy-loaded.
   - Needs: tasks 6, 7
10. **Phone speed, offline answers and load test** (section 9)
    - Done when: Lighthouse numbers before/after in the note and on target; offline test passes; load test passes with
      0 errors and p95 under 2 s; cleanup works.
    - Needs: tasks 1–9

## 11. Not in this update

- The child picture on the landing page (the team is choosing the design).
- A real payment provider (Payme or Click need a merchant contract first).
- QR code images, the specialist sign-off paperwork, the dry run with families and the event itself.

## 12. Checks before each push

- In `apps/web/`: `npm run typecheck`, `npm run lint`, `npm test`.
- If anything in `apps/api/` changed: `uv run pytest`, `uv run ruff check .`, `uv run mypy app tests migrations`.
- Open the landing page, sign-up, the questionnaire, Overview, Plan, Games and Account at 360 px and 1366×768, in
  Uzbek, Russian and English.
- After the last task, write a short plain-language report: what changed; the Lighthouse and load-test numbers; the
  token values you had to adjust; the missing consents or parent controls you listed; which `uz` texts need a native
  speaker; anything that could not meet a rule and why.
