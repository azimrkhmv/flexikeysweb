# FlexiKeys — Warm Hills design, Cloudy, quick start, Cloudy games and exercise slots (Bekzod, 15 Nov 2026)

You are working in the `flexikeysweb` repository. Read `CLAUDE.md` first and follow its rules (work on `main`, pull
first, commit prefixes, tests green before push, never edit a pushed migration).

This file turns the one-page demo Bekzod approved on 15 Nov 2026 into tasks. The demo is two files, `index.html` and
`core.js`. Bekzod puts them in `docs/demo-2026-11-15/` before you start; if the folder is missing, stop and write
`- BLOCKED: demo files missing` under task 1. **The demo is the reference for how things look and move. This file is
the reference for what to build.** Where they disagree, this file wins. Do not copy the demo's code structure; it is
plain JavaScript in one page, and the repo has its own components, content files and tests.

Every point below already has a decision. Do not ask again; build what is written. If something here is impossible
without breaking a product rule in `CLAUDE.md`, stop and write `- BLOCKED: <why>` under the task in `TASKS.md`.

Before you start, check that `B81` (animation, the `motion` package) is ticked. If it is not, do `B81` first. The
other skill-game tasks (`B82`–`B89`) do not block this file, except where a task below says so.

---

## 0. Before you start

1. **Record these decisions** in `TASKS.md` section 3 ("Decisions already made"), dated 15 Nov 2026, by Bekzod:
   - **Vision:** the site is minimal and built around five things: a short start questionnaire, the plan, games,
     exercise videos, and Cloudy. Everything else is secondary and sits behind one "More" entry.
   - **Design:** "Warm Hills" (section 2) is the default look. Three other colour schemes stay as a setting.
   - **Quick start:** a new parent gets a first plan after **at most 22 questions** (section 4). The full
     questionnaire stays, as an optional "Make the plan more exact" step. This goes further than the 5 Nov
     "10 minutes" decision; it does not replace the Quick check.
   - **Cloudy** (section 5) moves around the parent pages, changes into animals, and gives a 4-step tour. A switch
     "Cloudy moves" turns the movement off. Cloudy never moves around during a child's game.
   - **Two Cloudy games** (section 6), Find Cloudy and Grow Cloudy, are the featured games.
   - **Exercise videos** (section 7) ship as a section with empty slots. A video is shown only after the physio
     approves that exercise.
   - **No dragon for now.** Bekzod skipped the dragon form on 15 Nov 2026. Grow Cloudy ends with the tiger. Do not
     draw or add a dragon; see `Q16`.
2. **Add two questions** to `TASKS.md` section 6, owner Bekzod, with the next free numbers (`Q16`, `Q17`):
   - `Q16`: "Dragon art for Cloudy: Bekzod supplies an original or licensed image file. Until then there is no
     dragon form." Needed for: nothing.
   - `Q17`: "Which colour scheme is the default for the jury demo: Warm Hills, Sky, Mint or Lilac?" Needed for:
     nothing (Warm Hills until answered).
3. **Add the tasks** in section 10 to `TASKS.md` section 5 as a new group "Warm Hills and Cloudy (15 Nov 2026)",
   owner Bekzod, with the next free `B` numbers (after `B89`), each with its Done when / Needs lines.
4. Work through them in order, one commit per task, as `CLAUDE.md` says.

## 1. Rules for every change in this file

- **Product rules stay.** No diagnosis. The child never sees a number. Child screens have no timer, no red, no X and
  no failure sound; after 2 mistakes the right answer gently pulses (rule 7 and the 5 Oct brief).
- **Mock mode and live mode both work.** The Vercel demo runs in mock mode with no server.
- **Every text people see in `en`, `ru`, `uz`.** This file gives `en`. Write `ru` and `uz` (Latin) yourself, plain and
  short, and mark the `uz` with `"uz text drafted 15 Nov 2026 — native-speaker check (B44)"`. Components never
  hardcode words; texts live in `messages/` or content files.
- **Server and website agree** wherever a rule lives twice (questionnaire, bridge, skill). Cover new functions with
  rows in the shared cases files.
- **Animation:** only `transform` and `opacity`, through `motion` (already allowed) or CSS. Wrap in
  `<MotionConfig reducedMotion="user">`. With `prefers-reduced-motion: reduce`, Cloudy does not move around and
  clouds do not drift.
- **No new packages.** Fonts: the demo uses Fredoka (headings) and Nunito (text). Nunito is already in the repo. Add
  Fredoka through `next/font` only; that is the single exception.
- **No art from other people.** Every shape of Cloudy and the scenery is drawn in code as in the demo. Do not add
  image files found on the internet.
- **Accessibility:** every control keeps a visible focus ring and works with the keyboard. Cloudy and the drifting
  clouds are `aria-hidden` decoration, except the tour text, which is a polite live region.

---

## 2. Warm Hills design

### 2.1 Tokens
Add the scheme as CSS variables (in the place the repo keeps theme tokens; if Tailwind theme colours are used, map
them to these variables). Values are copied from the demo's `:root` blocks.

| Token | Warm Hills (default) | Sky | Mint | Lilac |
|---|---|---|---|---|
| page background `--sky` | `#FFF1D6` | `#EFF5FD` | `#EDF8F1` | `#F5F0FC` |
| deep tint `--sky-deep` | `#F9C785` | `#C3D8F5` | `#B9E2CC` | `#D6C7F2` |
| card `--paper` | `#FFF9EC` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| text `--ink` | `#4A2E1A` | `#1F2A56` | `#1F3A44` | `#2A2550` |
| soft text `--muted` | `#7A6248` | `#59627A` | `#566A66` | `#655F7A` |
| accent `--accent` | `#F08A3C` | `#5B76D6` | `#3BA98C` | `#8B6BD6` |
| accent text `--accent-text` | `#B5531A` | `#3B53B5` | `#1F7A66` | `#6344B5` |
| success `--leaf` | `#5B8C4A` | `#2A8271` | `#2A8271` | `#2A8271` |
| highlight `--sun` | `#FFC85C` | `#BFD0F7` | `#FFC94D` | `#D3C4F5` |
| thin lines `--line` | `#EBD3A9` | `#D5E1F2` | `#CFE7DA` | `#E2D8F3` |
| outline `--edge` | `#6B4426` | `#34447F` | `#2C5A4E` | `#4A3F7A` |
| hills `--hill1` / `--hill2` | `#F7BE6E` / `#EFA349` | `#B7CFF2` / `#93B3E8` | `#A5DBC0` / `#7CC7A4` | `#CBBBF0` / `#B09AE6` |
| button `--btn-a` → `--btn-b` | `#FFB25E` → `#F08A3C` | `#6C86DE` → `#4A63C4` | `#FFCB73` → `#F9AE3F` | `#9C7FE0` → `#7352C4` |
| button text `--btn-text` | `#4A2E1A` | `#FFFFFF` | `#1F3A44` | `#FFFFFF` |

- The scheme is chosen in **Account** ("Colours", four round swatches) and stored on the device (`localStorage`,
  try/catch, default Warm Hills). It is not stored on the server.
- Dark mode: keep the repo's current dark mode working. If a scheme has no dark values yet, dark mode uses the
  current dark palette for all four schemes; do not invent dark values in this task.
- Check contrast: body text and button text must reach 4.5:1 in all four schemes. Write the measured values in the
  task note.

### 2.2 Shapes
- Cards, buttons, tiles, inputs: a **1.5 px outline** in `--edge`, corner radius 24 px (cards) / 16–18 px (tiles,
  inputs) / full (buttons, chips).
- Main button: vertical gradient `--btn-a` → `--btn-b`, a 4 px solid lower edge in `--edge` (it looks like a key),
  moves down 3 px when pressed. Second button: `--paper` with the outline, no lower edge.
- No orange highlighter stripe under heading words (Bekzod removed it).
- Scenery: a pale sun, two round hills and three small trees, as in the demo's `.vista` and `.ground`. Use it on the
  first screen (2.3) and as the page foot of parent pages. Not on child game screens.

### 2.3 First screen for a new parent
Replace the empty Overview state ("Let's add your first child") with the demo's top section:
- Heading: "A calm daily plan for your child, from a few short answers."
- Text: "FlexiKeys gives children aged 2 to 18 with movement or learning difficulties a few minutes of games and
  exercises each day. You answer, we build the plan, your child plays with Cloudy."
- Buttons: **"Start, 2 minutes"** (opens the quick start, section 4) and **"Play with Cloudy"** (opens the games demo).
- Four small numbered chips: Answer · Get the plan · Play · Move.
- The scenery card on the right, with the floating F and K keys.
- Do not promise a number of questions in the heading; the number can change after the physio's review.

### 2.4 Simpler navigation
- Parent sidebar shows four main entries: **Overview**, **Games**, **Exercises** (new, section 7) and **Plan** (the
  child's plan and progress; reuse the existing child tabs). Below a divider, one entry **More** opens the rest:
  Reports, Find help, Home Kit, Assistant, Subscription, Account. No page is removed; only the menu changes.
- On phones the same four entries are the bottom bar, with "More" as the fifth.

---

## 3. Small effects from the demo

- Cards with the class the demo calls `.tilt` (plan cards, game cards, exercise cards) lean up to 8° toward the
  mouse with a soft light spot. Mouse only; nothing on touch.
- Main buttons have the moving shine on hover.
- Questionnaire questions slide in from the right (about 0.35 s); game tiles pop in.
- All of this is off with reduced motion.

---

## 4. Quick start: a first plan after at most 22 questions

### 4.1 What it is
- "Start, 2 minutes" opens the questionnaire in **quick mode**: one question per screen, a progress bar of short
  dashes, Back and Next, as in the demo.
- Mark the quick questions with `"quick": true` in `questionnaire.json` (add the field to `QQuestion` and the server
  schema). **At most 22 questions are shown in quick mode for any child.** A test counts them for personas M, W and S
  from the 5 Nov file and fails above 22.
- The quick set is, in this order:
  1. Child basics: name, date of birth, boy or girl, home languages (A7_langs).
  2. Diagnosis (B1) and affected body parts (B3_parts).
  3. The six Quick check rows (QC_move, QC_hands, QC_body, QC_senses, QC_talk, QC_daily), shown as one screen.
  4. How the child walks (C6) and, only if C6 is not "walks alone", how the child sits (C3).
  5. How the child uses a screen (the question that feeds the input mode: touch, hold-to-choose, switch).
  6. Goals (J9, pick up to 3).
  7. **Every question that feeds a safety rule** ("what to avoid": choking, pain, wounds, seizures, and any other you
     find in `rules.py`). List them in the task note. If adding them takes the count above 22, keep all safety
     questions and drop from points 4–6 first; write what you dropped.
- Height and weight (A4, A4_kg) are **not** in the quick set. They stay required in the full questionnaire only.
  Check that the plan engine and the bridge work with no height and weight.

### 4.2 The plan from quick answers
- After the last quick question, build the plan at once from `effectiveAnswers` (5 Nov file): sections marked
  "No difficulty" are filled with typical answers; **sections marked "A little" or "A lot" have no answers yet and
  must not be filled with typical answers.** With no answer, a rule never matches, as now.
- Safety check for you to prove with cases in `roadmap_cases.json`: for each "A little" / "A lot" section that is not
  answered yet, the quick plan must contain **no exercise or game that a full answer could have forbidden**. If the
  engine cannot guarantee that for an area, the quick plan leaves that area out and shows the line in 4.3. Check
  every changed case by hand (rule 2) and list them for the physio.
- The plan is marked `quick: true` on the server and the website (new nullable column, new migration; mock database
  too).

### 4.3 "Make the plan more exact"
- On the plan page, while the plan is `quick`, show one calm card: "This is a first plan from your short answers.
  Answer a few more questions about {area names} and it gets more exact." Button: "Answer more". It opens the full
  questionnaire at the first section that is not answered, with the quick answers already filled in.
- When the full questionnaire is finished, rebuild the plan and clear `quick`.
- A therapist sees "Quick plan — full questionnaire not finished" on the child page.
- Old children and their plans are not touched.

---

## 5. Cloudy

### 5.1 What Cloudy is
One shared component (the demo's `Puff`), used by the page mascot, the tour and both Cloudy games.
- **Body:** 12 soft round puffs with a thick outline in `--edge`, a 5 px lower edge (so it looks raised), a light
  top, a darker bottom, a small shine spot and two feet that paddle when Cloudy moves fast.
- **Forms:** cloud, bunny, cat, fox, bear are made by moving the same 12 puffs (positions are in the demo's `FORMS`
  table; copy the numbers). **Tiger** is a full drawing (the demo's `art-tiger`): Cloudy shrinks into a small ball,
  sparkles, and the tiger pops out. Keep the code path for "drawn forms" so a dragon file can be added later (`Q16`).
- **Faces:** happy (closed eyes, the default), surprised, wink, laugh.
- **Colours follow the scheme.** Copy the demo's `tones()` function: cloud = white with a `--sky-deep` shade, bunny =
  white with an accent shade, cat = `--sky-deep`, fox = `--accent`, tiger = `--accent-text`, bear = `--hill2`. A
  form is repainted when the scheme changes. No form may show a colour that is not in the current scheme.
- A change of form takes about 0.9 s with a small burst of sparkles in `--sun`.

### 5.2 Cloudy on the parent pages
- Five outlined clouds drift slowly to the right across the page behind the cards, each bobbing a little (speeds and
  sizes as in the demo). They are fixed to the screen, not to the page.
- Cloudy follows one cloud and, about every 5 seconds, does one of these (weights as in the demo's `act()`):
  hops to another cloud and changes form · slips behind his cloud, then peeks out · flies to a visible button and
  sits on it (the button squashes a little) · makes his cloud rain · pops his cloud, drops, and the cloud grows back
  · blows a cloud so it rushes away.
- When the mouse comes within about 70 px he looks surprised and jumps. When the mouse rests on a main button he
  comes and sits on it (at most once every 5 seconds).
- When he flies fast, a short trail of fading dots follows him.
- Pressing Cloudy changes his form and his face and makes him jump. A small speech box says "Now I am a fox."
- **Layers:** clouds are behind all content. Cloudy is in front of content when riding, sitting or flying, and behind
  his cloud when hiding. He never takes clicks away from a control under him (`pointer-events: none`; his own press
  is found by position, as in the demo).
- **Where:** parent pages only (Overview, Plan, Games list, Exercises, More pages). **Never** on the child's play
  screens, the questionnaire's question screens, sign-in or payment screens. On the questionnaire he sits still in
  the corner.
- Must not cost more than about 2 ms a frame on a mid phone; stop the loop when the tab is hidden. Write the
  measured number in the task note.

### 5.3 The "Cloudy moves" switch
- A switch in the header: "Cloudy moves: On / Off", stored on the device. Also in Account.
- **Off:** Cloudy sits in the bottom-right corner as a cloud and the page clouds keep drifting. Pressing him still
  changes form and face with a small jump. Nothing else is switched off.
- With `prefers-reduced-motion: reduce` the switch starts Off and the clouds do not drift.

### 5.4 The tour
- On a parent's first visit Cloudy offers: "Hi, I am Cloudy. Want a short tour? It has 4 steps." Buttons: "Show me
  around" / "No thanks".
- Steps (each scrolls to the place, puts a dashed ring around it, and changes Cloudy's form):
  1. Start: "Answer a few short questions here. It takes about 2 minutes."
  2. Plan: "This is the plan for each day: two games, one free choice and one exercise."
  3. Games: "Play with me here. Find me in the clouds, or feed me rain and help me grow."
  4. Exercises: "Short exercise videos live here. A physiotherapist checks each one first."
- "Next", "Stop the tour" on every step. Escape stops it. The tour can be started again from pressing Cloudy.
- Whether the tour was offered is stored on the device, so it is offered once.

---

## 6. Two Cloudy games

Both are skill games in the sense of the 8 Nov file (section 2.3 there): one entry each in `skillGames.ts`, 12 steps
(4 tiers × 3 steps), rows in `games.json`, rounds made by `makeRounds(settings, seed)` with the one-right-answer
test, telemetry through `usePlay()`, and all four input modes (touch, hold-to-choose, switch, keyboard). They need
`B82` (the skill-game base). They are shown first and larger in the Skill games tab and on `/demo/games`.

The demo shows tier steps 1 only; fill the steps between so each is a little harder, and write the full table in
the task note.

### 6.1 Find Cloudy — kind `find_cloudy`, area Attention
Clouds float in a small sky scene. Cloudy hides behind one. The child chooses the cloud. It is a choice game: build
it on `ChoiceEngine` with a custom scene. Nothing is timed; the child may wait as long as they like.

| Tier | Clouds | What Cloudy does |
|---|---|---|
| Seed, step 1 | 3 | Stays half out of his cloud the whole time |
| Sprout | 5 | Peeks out for about a second, every few seconds, again and again |
| Tree | 6 | Peeks once, then pairs of clouds swap places 3 times; a "Show again" button repeats it |
| Summit, step 3 | 8 | Peeks once, clouds swap 6 times, and once Cloudy jumps to another cloud in view |

- The clouds are still before the child may choose (so it works with switch scanning).
- Right cloud: it puffs away, Cloudy comes out, changes into an animal and shows its move: bunny hops, fox dashes
  across, cat disappears and comes back in another place. One short sentence names it ("Cloudy is a fox now. Foxes
  run fast!").
- Wrong cloud: it wobbles softly. After 2 wrong choices the right cloud glows.
- 3 rounds a session at every step.

### 6.2 Grow Cloudy — kind `grow_cloudy`, area Memory
Raindrops float above Cloudy (they do not fall away). The child taps drops; each drop flies to Cloudy, who gulps it.
A row of small drop marks fills up. When it is full, Cloudy grows and changes: **cloud → bunny → fox → bear →
tiger**. Four growth stages make one session.

| Tier | Drops per stage | Rule |
|---|---|---|
| Seed, step 1 | 3 | Tap any drop |
| Sprout | 3 drops + 3 leaves | Tap only the drops; a tapped leaf just floats away, with no mistake counted |
| Tree | 4, all different sizes | Tap from smallest to biggest |
| Summit, step 3 | 5, numbered | Numbers show for about 3 seconds, then hide; tap in order 1, 2, 3… |

- Wrong drop: it wobbles softly. After 2 wrong taps: Tree shows a glow on the right drop; Summit shows the numbers
  again for a moment.
- Ending: the tiger leaps up, the sky turns to evening, stars and a rainbow appear, and the scene shakes very gently
  for about a second. **No sound.** With reduced motion: no shake, no leap, only the rainbow fades in.
- The child sees no number except the drop numbers at Summit (those are the task, not a score).
- Summit numbers need the child to read digits: offer Summit steps only when the child's Math tier 2 is open.

---

## 7. Exercises section with slots

- New parent page **Exercises**. Heading text: "Short videos, about two minutes each, that a parent and child do
  together. A video appears here only after our physiotherapist approves the exercise."
- New content file `exercises.json` (two identical copies, as for other content): one row per exercise with `id`,
  the title in three languages, `body_area` (arms, hands, legs, back_and_tummy, whole_body), `approved` (boolean,
  default false), `video` (file key or null), `approved_by`, `approved_at`.
- Start with these seven rows, all `approved: false`, `video: null`: Reach for a toy · Open and close the hand ·
  Sit to stand · Sitting balance · Tummy time with a toy · Animal walks · Rolling to the side. These names are
  place-holders from the demo; the physio decides the real list.
- A card per exercise: a calm poster with a play mark, the title, the body area, "about 2 min". An exercise that is
  not approved or has no video shows the label **"Waiting for physio check"** and cannot be played. An exercise in the
  child's plan shows **"In the plan"** and is listed first.
- **The plan engine must never put an exercise in a plan unless `approved` is true.** Add a test.
- Videos are uploaded by an admin (reuse the existing file storage; no new service). Admin page: list of exercises,
  upload a video, tick "approved" with the physio's name. If an admin page for content does not exist yet, add the
  page with these two actions only.
- No AI-made video is produced in this task. Bekzod's team supplies the files.

---

## 8. Things not to change

- The questionnaire's questions, ids, rules and the Quick check (5 Nov file). Section 4 only adds the `quick` flag,
  quick mode and the "more exact" card.
- The 16 theme worlds, the three-slot plan, the 20-minute daily limit, the weekly rule.
- The child's play screens keep their rules; Cloudy does not move around there.
- `SectionIntro.tsx`.
- No dragon. No art files from outside.

## 9. Open points for Bekzod (do not wait for them)

- `Q16` dragon art, `Q17` default colour scheme.
- The physio must check: the quick set and the safety cases (4.2), the exercise list (7), and that Find Cloudy at
  Summit is not too hard to follow for children with a learning delay.

## 10. Tasks to add to TASKS.md (in this order)

1. **Warm Hills tokens, shapes and the colour setting** (2.1, 2.2)
   - Done when: the four schemes exist as tokens; Warm Hills is the default; the swatches in Account switch the
     scheme and it is remembered on the device; cards, buttons, tiles and inputs have the outline and the key-style
     button; contrast numbers are in the note; dark mode still works.
   - Needs: —
2. **First screen and simpler navigation** (2.3, 2.4, 3)
   - Done when: a parent with no child sees the new first screen with scenery; the sidebar shows four main entries
     and "More"; no page is lost; tilt, shine and slide effects work and are off with reduced motion.
   - Needs: task 1
3. **Cloudy component** (5.1)
   - Done when: one component draws the six forms and four faces, changes form with sparkles, takes its colours from
     the scheme and repaints on a scheme change; a test page shows every form in every scheme.
   - Needs: task 1
4. **Cloudy on the parent pages, the switch and the tour** (5.2, 5.3, 5.4)
   - Done when: clouds drift and Cloudy does all six actions; he never blocks a click; he is absent from child play
     screens and still on the questionnaire; "Cloudy moves: Off" parks him and pressing him still changes form and
     face; the tour runs its 4 steps and can be stopped; reduced motion starts Off; the frame cost is in the note.
   - Needs: task 3
5. **Quick start** (4)
   - Done when: quick mode shows at most 22 questions for personas M, W and S (test); a plan is built right after;
     the safety cases pass and are listed for the physio; the "more exact" card opens the full questionnaire with
     answers filled in; finishing it clears `quick`; old children are unchanged; works in mock and live mode.
   - Needs: task 2
6. **Find Cloudy** (6.1)
   - Done when: the game plays all 12 steps on `/demo/games` with touch, hold-to-choose, switch and keyboard; rounds
     pass the one-right-answer test; nothing is timed; texts in en, ru, uz.
   - Needs: task 3, `B82`
7. **Grow Cloudy** (6.2)
   - Done when: as task 6 for this game; the four stages end with the tiger; the ending has no sound and is calm
     with reduced motion; Summit is offered only with Math tier 2 open.
   - Needs: task 6
8. **Exercises section with slots** (7)
   - Done when: the page shows the seven slots as "Waiting for physio check"; an admin can upload a video and mark an
     exercise approved; an approved exercise with a video plays; the plan never includes an exercise that is not
     approved (test); works in mock and live mode.
   - Needs: task 2

**Needs:** as written on each task. Tasks 6–8 can be done in any order after their needs.

## 11. Checks before each push

- In `apps/web/`: `npm run typecheck`, `npm run lint`, `npm test`.
- In `apps/api/` (with `docker compose up -d db redis minio`): `uv run pytest`, `uv run ruff check .`,
  `uv run mypy app tests migrations`, `uv run alembic upgrade head` on a fresh database.
- If a server address changed: `UPDATE_OPENAPI=1 uv run pytest tests/test_openapi.py`, then `npm run typecheck`.
- Open the parent pages in all four schemes, in Uzbek, Russian and English, at phone width and on a 1366×768 laptop.
  Watch Cloudy for two minutes on each: he must never cover a control so that it cannot be read or pressed for more
  than a few seconds.
- Play both Cloudy games at Seed and at Summit, once with touch and once with switch scanning.
- After the last task, write a short plain-language report: what changed; the quick set and its count per persona;
  the safety cases for the physio; the contrast numbers; the frame cost of Cloudy; which `uz` texts need a native
  speaker; and anything that could not meet a rule and why.
