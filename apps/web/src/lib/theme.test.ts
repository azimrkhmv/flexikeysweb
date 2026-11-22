import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLOUDY_TONE_FORMS, contrast, PALETTES, SETS, THEME_CSS, TOKEN_NAMES, tokensOf } from "./theme";
import { readdirSync, readFileSync as readSrc, statSync } from "node:fs";
import { join } from "node:path";
import { NOTE_COLOURS, NOTE_INK, TASK_COLOURS } from "@/content/taskColors";
import { ringsOf, TASK_SURFACES, taskRingOn } from "./theme";

// B107, Update 3 spec 2.3: the contrast of the spec's pairs in all 11 sets (WCAG 2.2 AA: 4.5:1 for text, 3:1 for a
// game target's edge), and our own pairs for the pale tints derived in lib/theme.ts.

const SPEC_PAIRS: [what: string, fg: string, bg: string, min: number][] = [
  ["body text on a card", "ink", "paperSolid", 4.5],
  ["soft text on a card", "muted", "paperSolid", 4.5],
  ["accent text on a card", "accentText", "paperSolid", 4.5],
  ["button text on the top of the main button", "btnText", "btnA", 4.5],
  ["button text on the bottom of the main button", "btnText", "btnB", 4.5],
  ["text on the page", "ink", "sky2", 4.5],
  ["soft text on the page", "muted", "sky1", 4.5],
  ["Cloudy's face on his body", "cloudyFace", "cloudyBody", 4.5],
  ["a game target's edge on the sky", "gameEdge", "sky2", 3],
];
// Ours: every text colour on every surface it is used on.
const OUR_PAIRS: [string, string, string, number][] = [
  ["text on the Light / Dark and Soft / Sharp pills", "ink", "line", 4.5],
  ...["sky1", "sky2", "tint", "tint2", "accentSoft", "sunSoft"].flatMap((bg): [string, string, string, number][] => [
    [`body text on ${bg}`, "ink", bg, 4.5],
    [`soft text on ${bg}`, "muted", bg, 4.5],
  ]),
  ["accent text on the page", "accentText", "sky1", 4.5],
  ["accent text on a pale chip (tint)", "accentText", "tint", 4.5],
  ["accent text on a pale chip (tint2)", "accentText", "tint2", 4.5],
  ["accent text on its pale wash (menu, soft buttons)", "accentText", "accentSoft", 4.5],
  ["a card colour on the text colour (inverted emergency button)", "paperSolid", "ink", 4.5],
  ["the focus ring (accent text) on the page", "accentText", "sky2", 3],
  // Cloudy's face on each of his forms (a drawing: 3:1).
  ...CLOUDY_TONE_FORMS.map((f): [string, string, string, number] => [`Cloudy's face on the ${f}`, "cloudyFace", `cl-${f}`, 3]),
];

describe("the 11 sets", () => {
  it("are Warm Hills, Sky, Mint, Lilac, Peach in light and dark, and Night in dark", () => {
    expect(SETS.map((s) => s.join("."))).toEqual([
      "warm.light", "warm.dark", "sky.light", "sky.dark", "mint.light", "mint.dark", "lilac.light", "lilac.dark", "peach.light", "peach.dark", "night.dark",
    ]);
  });
  it("each has every token", () => {
    for (const [s, m] of SETS) expect(Object.keys(PALETTES[s][m]).sort()).toEqual([...TOKEN_NAMES].sort());
  });
  it("hold the demo's values exactly (the palette between PALETTES-START and PALETTES-END)", () => {
    const demo = readFileSync(new URL("../../../../docs/demo-2026-11-19/index.html", import.meta.url), "utf8");
    const between = (text: string) => text.slice(text.indexOf("const P = {"), text.indexOf("/* PALETTES-END */")).replace(/\s+/g, "");
    const ours = readFileSync(new URL("./theme.ts", import.meta.url), "utf8");
    expect(between(ours).length).toBeGreaterThan(5000);
    // B116 (Update 4 spec 7.1): Warm Hills light is white-warm; every other value stays the demo's.
    const WHITE_WARM: Record<string, string> = {
      sky1: "#FFFFFF", sky2: "#FFF7EA", paper: "rgba(255,255,255,.86)", paperSolid: "#FFFFFF", ink: "#3D2A1C", muted: "#6E5A47",
      accent: "#F29A4A", accentText: "#A8521C", btnA: "#FFC47E", btnB: "#F49B4B", btnText: "#3D2A1C", line: "#F0DFC4",
      sun: "#FFD36E", sunGlow: "#FFE9B8", hillFar: "#FCE9CC", hill1: "#F8D9A8", hill2: "#F4C68A", cloud: "#FCEBD3",
    };
    const d = between(demo);
    const start = d.indexOf("warm:{light:{");
    const end = d.indexOf("}", start);
    let warm = d.slice(start, end);
    for (const [k, v] of Object.entries(WHITE_WARM)) warm = warm.replace(new RegExp(`([{,])${k}:"[^"]*"`), `$1${k}:"${v}"`);
    expect(between(ours)).toBe(d.slice(0, start) + warm + d.slice(end));
    expect(PALETTES.warm.light.sky1).toBe("#FFFFFF");
  });
  it("Cloudy's face is the scheme's dark text colour in light and in dark mode", () => {
    expect(PALETTES.warm.dark.cloudyFace).toBe(PALETTES.warm.light.ink);
    expect(PALETTES.night.dark.cloudyFace).toBe("#2A2F5C");
  });
  it("Night's light set is its dark set", () => expect(PALETTES.night.light).toBe(PALETTES.night.dark));
  it("the CSS has a block for every scheme and mode", () => {
    for (const [s, m] of SETS) expect(THEME_CSS).toContain(`[data-scheme="${s}"][data-mode="${m}"]{`);
  });
});

describe("contrast in all 11 sets (WCAG 2.2 AA)", () => {
  for (const [s, m] of SETS) {
    const t = tokensOf(s, m) as Record<string, string>;
    for (const [what, fg, bg, min] of [...SPEC_PAIRS, ...OUR_PAIRS])
      it(`${s} ${m}: ${what} ≥ ${min}:1`, () => expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min));
  }
});
// B109, Update 3 spec 5: every task colour stands out 3:1 from the game surfaces in all 11 sets, or it is drawn with
// a 2 px ring in the set's ink (which is at least 4.5:1 on those surfaces, above).
describe("task colours: 3:1 on the game surfaces, or a ring", () => {
  for (const [name, looks] of Object.entries(TASK_COLOURS))
    it(name, () => {
      for (const [s, m] of SETS) {
        const t = tokensOf(s, m) as Record<string, string>;
        const ring = ringsOf(s, m)[`ring-${name}`];
        for (const look of looks)
          for (const surface of TASK_SURFACES) {
            const best = Math.max(...look.map((c) => contrast(c, t[surface])));
            if (best >= 3) continue;
            expect(ring, `${name} in ${s} ${m} on ${surface}: ${best.toFixed(2)}:1 needs a ring`).toBe(t.ink);
            expect(contrast(ring, t[surface])).toBeGreaterThanOrEqual(3);
          }
        if (!taskRingOn(name, s, m)) expect(ring).toBe("transparent");
        expect(THEME_CSS).toContain(`--ring-${name}:${ring};`);
      }
    });

  it("the print on every note and coin is readable (4.5:1)", () => {
    for (const [v, c] of Object.entries(NOTE_COLOURS)) expect(contrast(NOTE_INK, c), v).toBeGreaterThanOrEqual(4.5);
  });

  it("every kind of task colour is drawn with its ring", () => {
    const SRC = join(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.tsx$/.test(n) ? [join(d, n)] : []));
    const code = walk(SRC).map((p) => readSrc(p, "utf8")).join("\n");
    for (const kind of new Set(Object.keys(TASK_COLOURS).map((n) => n.split("-")[0]))) expect(code, kind).toMatch(new RegExp(`ringStyle\\([^)]*[\`"]${kind}-`));
  });
});
