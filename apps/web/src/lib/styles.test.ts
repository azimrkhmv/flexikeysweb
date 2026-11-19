import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// B108, Update 3 spec 3: Soft and Sharp. Soft is the default; both styles are defined; blur only on the header, the
// page background clouds and the scenery (never cards, text, buttons or game targets).

const SRC = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const css = readFileSync(join(SRC, "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const BLUR_ALLOWED = [".fk-header", ".fk-skycloud", ".fk-hill", ".fk-vcloud"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "server" && dir.endsWith(`${sep}lib`) ? [] : files(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("Soft and Sharp", () => {
  it("the page starts in Soft", () => {
    expect(readFileSync(join(SRC, "app/layout.tsx"), "utf8")).toMatch(/data-style="soft"/);
    expect(css).toMatch(/:root, \[data-style="soft"\] \{ --soft: 1; --sharp: 0;/);
    expect(css).toMatch(/\[data-style="sharp"\] \{ --soft: 0; --sharp: 1;/);
  });

  it("the shared parts switch with the style", () => {
    for (const sel of [".fk-btn", ".fk-btn-2", ".fk-card", ".fk-rim", ".fk-vista", ".fk-sunny", ".fk-hill", ".fk-puff"]) {
      const rule = css.match(new RegExp(`(?:^|\\n|\\s)${sel.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule, sel).toMatch(/var\(--(soft|sharp)\)/);
    }
    expect(css).toMatch(/\[data-style="sharp"\] \.fk-header \{/);
  });

  it("blur only on the header, the page background clouds and the scenery", () => {
    const bad: string[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/\bblur\(/.test(m[2])) continue;
      const sel = m[1].trim();
      if (!sel.split(",").every((s) => BLUR_ALLOWED.some((a) => s.includes(a)))) bad.push(sel);
    }
    expect(bad).toEqual([]);
    const tsx = files(SRC)
      .filter((p) => /(?<![.\w])(backdrop-)?blur(-\w+)?\b(?!\()|filter:\s*["'`]?blur|feGaussianBlur/.test(readFileSync(p, "utf8").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")))
      .map((p) => relative(SRC, p).split(sep).join("/"));
    expect(tsx).toEqual([]);
  });
});
