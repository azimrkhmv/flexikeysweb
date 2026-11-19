# FlexiKeys — Update 3, part 2: Soft and Sharp styles, six colour schemes, Appearance settings (Bekzod, 19 Nov 2026)

You are working in the `flexikeysweb` repository. Read `CLAUDE.md` first and follow its rules (work on `main`, pull
first, commit prefixes, tests green before push, never edit a pushed migration).

This file covers **Update 3 Tasks 3 and 4**: a softer, calmer look (with the old sharper look kept as an option) and
six colour schemes in which **every** colour matches. Part 1 (button size and the typing game) is a separate file.
The two parts touch different code; if part 1 is in progress, finish its current task first to avoid conflicts.

The demo is one file, `index.html`. Bekzod puts it in `docs/demo-2026-11-19/` before you start; if the folder is
missing, stop and write `- BLOCKED: demo files missing` under task 1. **The demo is the reference for how things look
and for every colour value. This file is the reference for what to build.** Where they disagree, this file wins. Do
not copy the demo's code structure (one plain-JavaScript page); the repo has its own components and tests. The
demo's control panel, explanation card and contrast table are demo aids, not app screens.

Every point below already has a decision. Do not ask again; build what is written. If something here is impossible
without breaking a product rule in `CLAUDE.md`, stop and write `- BLOCKED: <why>` under the task in `TASKS.md`.

---

## 0. Before you start

1. **Record these decisions** in `TASKS.md` section 3 ("Decisions already made"), dated 19 Nov 2026, by Bekzod. They
   replace the 15 Nov colour-scheme and shape decisions where they differ:
   - **Two styles.** **Soft** (new default): no dark outlines, rounder corners, soft shadows, calmer colours, a little
     blur in the background. **Sharp**: the 15 Nov Warm Hills shapes (thin dark outlines, key-style buttons with a
     lower edge, no blur). Both work with every colour scheme.
   - **Six colour schemes:** Warm Hills (default), Sky, Mint, Lilac, Peach, Night. Each of the first five has its
     own light and dark version. Night is dark only.
   - **Every colour follows the scheme**: page, cards, buttons, scenery (sky, sun or moon, hills, trees, clouds),
     Cloudy, game backgrounds and progress bars. No component keeps a fixed colour that does not belong to the
     scheme. The only fixed colours are pictures of real things and colours that are part of a task (section 5).
   - **Parent and child choose separately.** Parents choose colour, light/dark and style in **Account →
     Appearance**. The child chooses colour and style for the play screens with a **My colours** button on the play
     home. A new child starts with the parent's colour scheme and Soft.
   - **Not on the landing page.** No colour, style or light/dark control appears on the landing page, the first
     screen for a new parent, the questionnaire, sign-in or payment screens, or inside a game round.
2. **Change question `Q17`** in `TASKS.md` section 6 to: "Which colour scheme and style are the default for the jury
   demo? (Warm Hills + Soft until answered.)"
3. **Add the tasks** in section 9 to `TASKS.md` section 5 as a new group "Update 3 part 2 (19 Nov 2026)", owner
   Bekzod, with the next free `B` numbers, each with its Done when / Needs lines.
4. Work through them in order, one commit per task.

## 1. Rules for every change in this file

- **Product rules stay.** No diagnosis. The child never sees a number. Child screens have no timer, no red, no X and
  no failure sound.
- **Mock mode and live mode both work.** The Vercel demo runs in mock mode with no server.
- **Every text people see in `en`, `ru`, `uz`.** Texts below give `en` and `ru`; write `uz` (Latin) yourself and mark
  it `"uz text drafted 19 Nov 2026 — native-speaker check (B44)"`.
- **Animation:** only `transform` and `opacity`, as before. Reduced motion: page clouds do not drift, nothing bobs.
- **No new packages.**
- **Accessibility:** every new control works with the keyboard and has a visible focus ring; the settings panels
  close with Escape and return focus to the button that opened them.

---

## 2. Colour tokens

### 2.1 The tokens
Replace the 15 Nov theme tokens with this set. Copy every value **exactly** from the demo's palette object `P`
(between the `PALETTES-START` and `PALETTES-END` comments), plus `cloudyFace` from the lines right after it.

| Token | Used for |
|---|---|
| `sky1`, `sky2` | page and play-screen background (top → bottom gradient) |
| `paper`, `paperSolid` | cards (`paper` is slightly see-through, for Soft) and solid surfaces (panels, Sharp cards) |
| `ink`, `muted` | main text, soft text |
| `accent`, `accentText` | accent fills; accent-coloured text and links |
| `btnA`, `btnB`, `btnText` | main button gradient and its text |
| `line` | thin lines, tracks of bars, borders in Soft |
| `edge` | outlines in Sharp |
| `sun`, `sunGlow` | sun in light mode, moon in dark mode; stars use `sun` |
| `hillFar`, `hill1`, `hill2` | the three hills |
| `tree1`, `tree2`, `trunk` | tree crown, crown shade, trunk |
| `cloud` | drifting scenery clouds |
| `cloudyBody`, `cloudyShade`, `cloudyLine`, `cloudyFace`, `cheek` | Cloudy |
| `gameCloud`, `gameEdge` | targets in Cloudy games (fill and edge) |
| `shadow` | an `r,g,b` triple used as `rgba(var(--shadow), a)` |

- Values exist for: Warm Hills, Sky, Mint, Lilac, Peach (each `light` and `dark`) and Night (`dark` only) — 11 sets.
- Old token names from 15 Nov (`--sky`, `--sky-deep`, `--leaf`, `--btn-a` …): replace every use; do not keep two
  systems. The "correct" glow in games, which used `--leaf`, now uses `accent`.
- Cloudy's form colours (15 Nov `tones()`): cloud = `cloudyBody` with `cloudyShade`; bunny = `cloudyBody` with an
  `accent` shade; cat = `hill1`; fox = `accent`; tiger = `accentText`; bear = `hill2`. **Cloudy's face always uses
  `cloudyFace`**, never `ink`: in dark mode `ink` is light, and the face would disappear on his light body (Bekzod
  found this in the demo).

### 2.2 No colour outside the tokens (test)
Add a test that fails when a component or stylesheet in `apps/web/src` contains a raw colour (`#abc`, `#aabbcc`,
`rgb(`, `hsl(`, or a named colour other than `transparent`, `currentColor`, `inherit`), **except** in:
- the theme file that defines the tokens;
- `taskColors.ts` (section 5);
- a short allow-list file of paths, each line with a reason (for example a third-party embed). Start it empty.
This test is what stops "purple page, green trees". Fix every place it finds.

### 2.3 Contrast (test)
A test computes, for **all 11 sets**, the contrast of these pairs and fails below the limit:

| Pair | Limit |
|---|---|
| `ink` on `paperSolid`, `muted` on `paperSolid`, `accentText` on `paperSolid` | 4.5 |
| `btnText` on `btnA` and on `btnB` | 4.5 |
| `ink` on `sky2`, `muted` on `sky1` | 4.5 |
| `cloudyFace` on `cloudyBody` | 4.5 |
| `gameEdge` on `sky2` | 3 |

All pass with the demo's values; the test keeps it that way when someone changes a colour.

---

## 3. Soft and Sharp

Set the style with a `data-style="soft" | "sharp"` attribute on the root of the page (`<html>`), next to the scheme
and mode attributes. Parent pages use the parent's choice; child play pages use the child's choice (section 4).

| Part | Soft (default) | Sharp |
|---|---|---|
| Cards | radius 30 px, 1 px border in `line`, soft shadow (two layers, `shadow` at 10% and 5%), `paper` background | radius 24 px, 1.5 px border in `edge`, no shadow, `paperSolid` |
| Main button | gradient `btnA` → `btnB`, no border, soft shadow, lifts 2 px on hover, presses 1 px | the same gradient, 1.5 px `edge` border, 4 px solid lower edge in `edge` (key look), presses 3 px |
| Second button, chips, tiles, list rows | `paperSolid`, soft shadow, no border | 1.5 px `edge` border, no shadow |
| Header | `paper` with `backdrop-filter: blur(14px)` where supported | `paperSolid`, 1.5 px `edge` bottom line, no blur |
| Scenery | hills with a light blur (SVG Gaussian blur, about 1.3), blurred sun glow, blurred drifting clouds | no blur, 1.5 px `edge` outline on hills, sun and trees; no sun glow |
| Page background clouds | `filter: blur(9px)`, 75% opacity | no blur |
| Cloudy | outline in `cloudyLine` | thicker outline in `edge` |
| Game targets | never blurred in either style; edge in `gameEdge` | same |

- **Blur budget:** blur is allowed only on the header, the page background clouds and the scenery. Never on cards,
  text, buttons or game targets. On a mid Android phone, scrolling the Overview page in Soft must stay at about
  50 frames a second or more; write the measured number in the task note. If it is lower, drop the header blur first.
- Exact sizes, shadows and blur values: copy from the demo's CSS (Soft) and its `SHARP` list (Sharp).

---

## 4. Where people choose

### 4.1 Parents: Account → Appearance
- A new section **Appearance** (ru «Внешний вид») in Account with:
  - **Colour**: six round swatches with their names under them: Warm Hills / Тёплые холмы, Sky / Небо, Mint / Мята,
    Lilac / Сирень, Peach / Персик, Night / Ночь.
  - **Light / Dark** (ru «Светлая / Тёмная»). Keep the repo's current way of picking dark mode if it has an
    automatic "as on the device" option; add Night's rule below.
  - **Style**: Soft / Мягкий, Sharp / Чёткий.
- **Night and Light:** Night has no light version, but the **Light button is never disabled**. Pressing Light while
  Night is chosen switches to the last day scheme the parent used (Warm Hills if none), in light mode. On hover or
  focus it shows "Back to {scheme}, light". (Bekzod: a greyed-out button that forces you to pick another colour
  first was too annoying.)
- Changes apply at once, with a 0.4 s fade of colours. Stored on the device (`localStorage`, try/catch), as on
  15 Nov; not on the server.
- Remove the 15 Nov colour swatches from anywhere else they were added, and make sure no colour, style or light/dark
  control is on the screens listed in decision 0.1 ("Not on the landing page"). The "Cloudy moves" switch stays where
  the 15 Nov file put it.

### 4.2 Children: My colours
- On the **play home** (the world map and the Skill games tab), a round button with a brush, label **My colours**
  (ru «Мои цвета»). It is not shown during a game round.
- It opens a sheet with: six colour clouds (each drawn in its scheme's `accent`), **Soft** and **Sharp** buttons with
  a small round and square picture, and **Done**. Light/dark for the child follows the parent's setting (Night is
  always dark).
- The sheet works with touch, hold-to-choose, switch scanning and keyboard, and its targets are at least the child's
  `min_target_mm`.
- Stored on the device **per child** (key includes the child id), so siblings on one tablet keep their own choice. A
  new child starts with the parent's scheme and Soft.
- The child's choice changes only the child's play pages; the parent's pages keep the parent's choice.

---

## 5. Colours that never change

Some colours must stay the same in every scheme, or the child learns the wrong thing or a game breaks.
- **Pictures of real things**: emoji and drawings of fruit, animals, vehicles, banknotes and so on keep their own
  colours. An apple stays red on a purple page.
- **Task colours**: colours that are part of the answer — the colour groups in `sort`, `switch_sort` (and its yellow
  "by colour" frame), `secret_rule`, `opposite` (ink colours), `which_way` (the blue middle arrow), `fast_sort`, the
  bazaar note colours, and any other game where a colour is the rule. Move all of them into one file
  `apps/web/src/content/taskColors.ts` and use them from there.
- **Test:** each task colour must have a contrast of at least 3:1 against the surface it sits on (`paperSolid` or
  `gameCloud`) in all 11 sets. Where it does not (likely blue on dark surfaces), draw that item with a 2 px light ring
  around it instead of changing the colour.
- **Theme worlds:** the 16 worlds keep their pictures, but their **backgrounds** come from the child's scheme (`sky1`,
  `sky2`, hills, trees). A world is recognised by its pictures, not by its background colour.

---

## 6. Scenery and Cloudy follow the scheme

- The scenery from 15 Nov (`.vista` and the page foot) uses `hillFar`, `hill1`, `hill2`, `tree1`, `tree2`, `trunk`,
  `sun`, `sunGlow` and `cloud`. In dark mode the sun is the moon (same tokens) and a few small stars appear.
- Find Cloudy and Grow Cloudy draw their sky, clouds, raindrops and leaves from the child's scheme: targets use
  `gameCloud` and `gameEdge`; drops use `accent` with a `paperSolid` shine; leaves use `tree1`.
- A test page (extend the 15 Nov Cloudy test page) shows every Cloudy form and the scenery in all 11 sets and both
  styles, for a quick look.

---

## 7. The Progress card

The demo's Progress card follows the 8 Nov rules (B89); no change is needed. Check that the real card shows every
area that is open for the child (six for a child without typical hand use, seven with Speed), and "Not enough games
yet" for an area with fewer than 10 clean tries.

## 8. Things not to change

- The product rules, game rules and hints.
- The landing page content and the first screen text (15 Nov), except removing any appearance control.
- `SectionIntro.tsx`.
- The "Cloudy moves" switch and Cloudy's behaviour.
- Part 1 of Update 3.

## 9. Tasks to add to TASKS.md (in this order)

1. **Colour tokens for six schemes, and the colour tests** (section 2)
   - Done when: the 11 sets exist with the demo's values; old tokens are gone; the no-raw-colour test and the
     contrast test pass; Cloudy's face uses `cloudyFace`; nothing looks broken in any set (screenshots of Overview,
     Plan, a game and the questionnaire in each set, in the task note).
   - Needs: —
2. **Soft and Sharp styles** (section 3)
   - Done when: `data-style` switches every part in the table; Soft is the default; blur only where allowed; the
     frame-rate number is in the note; game targets are never blurred.
   - Needs: task 1
3. **Scenery, Cloudy and games follow the scheme; fixed task colours** (sections 5, 6)
   - Done when: scenery, Cloudy forms and both Cloudy games repaint with the scheme; `taskColors.ts` holds every task
     colour and the 3:1 test passes (with rings where needed); theme-world backgrounds come from the scheme; the
     test page shows all sets and both styles.
   - Needs: task 2
4. **Appearance settings for parents and My colours for children** (section 4)
   - Done when: Account → Appearance sets colour, light/dark and style; Light works from Night as described; the
     child's My colours sheet sets colour and style per child and works with all four input modes; no appearance
     control is on the landing page, first screen, questionnaire, sign-in, payment or game screens; works in mock and
     live mode.
   - Needs: task 3

## 10. Checks before each push

- In `apps/web/`: `npm run typecheck`, `npm run lint`, `npm test`.
- If anything in `apps/api/` changed: `uv run pytest`, `uv run ruff check .`, `uv run mypy app tests migrations`.
- Open Overview, Plan, Games, Exercises and Account in all 11 sets, both styles, in Uzbek, Russian and English, at
  phone width and on a 1366×768 laptop. Look for any colour that does not belong to the scheme.
- Play Find Cloudy and one sorting game in Lilac dark and in Night, once with touch and once with switch scanning.
- After the last task, write a short plain-language report: what changed; screenshots of each set; the frame-rate
  number; the task colours that needed a ring; which `uz` texts need a native speaker; anything that could not meet
  a rule and why.
