import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Game pictures are emoji. Emoji 13+ (2020) render as empty boxes on older Android / Windows / Chromebooks,
// so a child could face a blank card. Keep to Emoji ≤ 12; use ItemArt `art` drawings for anything newer.
const EMOJI_12_IN_SYMBOLS_EXT_A = new Set([
  ...[0x1fa70, 0x1fa71, 0x1fa72, 0x1fa73, 0x1fa78, 0x1fa79, 0x1fa7a, 0x1fa80, 0x1fa81, 0x1fa82],
  ...[0x1fa90, 0x1fa91, 0x1fa92, 0x1fa93, 0x1fa94, 0x1fa95],
]);
const NEWER_ELSEWHERE = new Set([0x1f6dd, 0x1f6de, 0x1f6df, 0x1f6fb, 0x1f6fc, 0x1f7f0, 0x1f90c, 0x1f972, 0x1f977, 0x1f978, 0x1f979, 0x1f9a3, 0x1f9a4, 0x1f9ab, 0x1f9ac, 0x1f9ad, 0x1f9cb, 0x1f9cc]);
const tooNew = (cp: number) => (cp >= 0x1fa70 && cp <= 0x1faff && !EMOJI_12_IN_SYMBOLS_EXT_A.has(cp)) || NEWER_ELSEWHERE.has(cp);

const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });

describe("emoji support", () => {
  it("no Emoji 13+ characters in content or UI", () => {
    const found = files(SRC).flatMap((f) =>
      [...readFileSync(f, "utf8")].filter((ch) => tooNew(ch.codePointAt(0)!)).map((ch) => `${f.slice(SRC.length)}: ${ch}`),
    );
    expect(found).toEqual([]);
  });
});
