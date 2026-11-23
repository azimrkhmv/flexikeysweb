import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// B119 (Update 4 spec 8.3): the Magic UI effect is on the landing page's main button only, lazily, with token colours.

const SRC = resolve(__dirname, "../..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [join(dir, f)] : []));

describe("Shine Border", () => {
  it("is used only by the landing page", () => {
    const users = files(SRC)
      .filter((f) => !f.includes(`${sep}components${sep}effects${sep}`))
      .filter((f) => /components\/effects/.test(readFileSync(f, "utf-8")))
      .map((f) => relative(SRC, f).split(sep).join("/"));
    expect(users).toEqual(["features/marketing/HomePage.tsx"]);
  });

  it("is lazy, token-coloured, and off with reduced motion or Cloudy still", () => {
    const s = readFileSync(join(__dirname, "LandingShine.tsx"), "utf-8");
    expect(s).toMatch(/dynamic\(\s*\(\) => import\("\.\/ShineBorder"\)[^)]*\)[^;]*ssr: false/);
    expect(s).toContain("if (!moves || reduced || !idle) return null;");
    const colours = s.match(/shineColor=\{\[([^\]]+)\]\}/)![1];
    expect(colours.split(",").map((c) => c.trim())).toEqual(['"var(--sun)"', '"var(--accent)"', '"var(--sun)"']);
  });

  it("keeps the MIT licence note and needs no shadcn set-up", () => {
    expect(readFileSync(join(__dirname, "ShineBorder.tsx"), "utf-8")).toContain("MIT License. Copyright (c) Magic UI.");
    expect(() => statSync(resolve(SRC, "../components.json"))).toThrow();
  });
});
