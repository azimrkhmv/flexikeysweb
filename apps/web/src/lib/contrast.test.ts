import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 2.2 AA for the design tokens in globals.css: 4.5:1 for text, 3:1 for focus rings and large text.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--fk-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`token --fk-${name} not found`);
  return m[1];
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

const TEXT: [string, string, string][] = [
  ["muted text on page", token("muted"), token("bg")],
  ["muted text on card", token("muted"), token("surface")],
  ["muted text on surface-2", token("muted"), token("surface-2")],
  ["ink-2 text on card", token("ink-2"), token("surface")],
  ["white on teal buttons", WHITE, token("teal")],
  ["teal text on card", token("teal"), token("surface")],
  ["teal text on page", token("teal"), token("bg")],
  ["white on primary buttons", WHITE, token("primary")],
  ["primary text on soft buttons", token("primary"), token("primary-soft")],
  ["primary links on page", token("primary"), token("bg")],
];

describe("token contrast (WCAG 2.2 AA)", () => {
  for (const [name, fg, bg] of TEXT) it(`${name} ≥ 4.5:1`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it("teal focus ring on page ≥ 3:1", () => expect(ratio(token("teal"), token("bg"))).toBeGreaterThanOrEqual(3));
});
