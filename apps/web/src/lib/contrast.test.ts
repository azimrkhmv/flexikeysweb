import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 2.2 AA for the colour schemes in globals.css (B99): 4.5:1 for text, 3:1 for focus rings and outlines.
// Every scheme is measured: Warm Hills (the :root block) and Sky, Mint, Lilac (the data-pal blocks over it).
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const block = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`${selector} not found`);
  const body = css.slice(at, css.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
};
const hills = block(":root");
export const SCHEME_TOKENS: Record<string, Record<string, string>> = {
  hills,
  sky: { ...hills, ...block(':root[data-pal="sky"]') },
  mint: { ...hills, ...block(':root[data-pal="mint"]') },
  lilac: { ...hills, ...block(':root[data-pal="lilac"]') },
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const WHITE = "#ffffff";

// [what, text token or colour, background token or colour]
const TEXT: [string, string, string][] = [
  ["body text on the page", "ink", "sky"],
  ["body text on a card", "ink", "paper"],
  ["soft text on the page", "muted", "sky"],
  ["soft text on a card", "muted", "paper"],
  ["button text on the top of the main button", "btn-text", "btn-a"],
  ["button text on the bottom of the main button", "btn-text", "btn-b"],
  ["second button text on paper", "ink", "paper"],
  ["links on the page", "link", "sky"],
  ["links on a card", "link", "paper"],
  ["link colour on its pale background (menu, soft buttons)", "link", "soft"],
  ["white on the link colour", WHITE, "link"],
  ["text on the highlight", "ink", "sun"],
  ["text on the deep tint", "ink", "sky-deep"],
  ["success text on the page", "leaf-deep", "sky"],
  ["success text on a card", "leaf-deep", "paper"],
  ["white on success", WHITE, "leaf-deep"],
  ["section banner title on teal-soft (B67)", "ink", "#d9f0ec"],
  ["section banner number and intro on teal-soft (B67)", "muted", "#d9f0ec"],
];

describe("colour scheme contrast (WCAG 2.2 AA)", () => {
  for (const [scheme, tk] of Object.entries(SCHEME_TOKENS)) {
    const c = (v: string) => (v.startsWith("#") ? v : tk[v]);
    for (const [name, fg, bg] of TEXT) it(`${scheme}: ${name} ≥ 4.5:1`, () => expect(ratio(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5));
    it(`${scheme}: focus ring on the page ≥ 3:1`, () => expect(ratio(tk["leaf-deep"], tk.sky)).toBeGreaterThanOrEqual(3));
    it(`${scheme}: the outline on the page and on a card ≥ 3:1`, () => {
      expect(ratio(tk.edge, tk.sky)).toBeGreaterThanOrEqual(3);
      expect(ratio(tk.edge, tk.paper)).toBeGreaterThanOrEqual(3);
    });
  }
  it("prints the measured numbers (for the task note)", () => {
    const rows = Object.entries(SCHEME_TOKENS).map(([s, tk]) => `${s}: text ${ratio(tk.ink, tk.sky).toFixed(1)} / ${ratio(tk.ink, tk.paper).toFixed(1)}, soft text ${ratio(tk.muted, tk.sky).toFixed(1)} / ${ratio(tk.muted, tk.paper).toFixed(1)}, button ${ratio(tk["btn-text"], tk["btn-a"]).toFixed(1)} to ${ratio(tk["btn-text"], tk["btn-b"]).toFixed(1)}, link ${ratio(tk.link, tk.sky).toFixed(1)}`);
    console.log(rows.join("\n"));
    expect(rows).toHaveLength(4);
  });
});