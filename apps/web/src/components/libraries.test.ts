import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// B118 (Update 4 spec 8.2): the child never sees a number and gets no toasts. No file a child route loads, directly or
// through other files, may import NumberFlow or Sonner (or our wrappers of them). The child area is the one in
// messages/areas.test.ts.

const SRC = resolve(__dirname, "..");
const CHILD = ["app/play", "app/demo", "features/play", "features/activities"];
const BANNED = ["@number-flow/react", "sonner", "@/components/Num", "@/components/Toasts"];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [join(dir, f)] : []));

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const importsOf = (file: string) => [...readFileSync(file, "utf-8").matchAll(/(?:import|export)[^"'`]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);

describe("child screens never load NumberFlow or Sonner", () => {
  it("not even through another file", () => {
    const start = CHILD.flatMap((d) => files(join(SRC, d)));
    expect(start.length).toBeGreaterThan(20);
    const seen = new Map<string, string>(); // file -> the file that imported it
    const queue = [...start];
    start.forEach((f) => seen.set(f, ""));
    const hits: string[] = [];
    while (queue.length) {
      const f = queue.shift()!;
      for (const spec of importsOf(f)) {
        if (BANNED.some((b) => spec === b || spec.startsWith(`${b}/`))) {
          const chain = [relative(SRC, f)];
          for (let p = seen.get(f); p; p = seen.get(p)) chain.unshift(relative(SRC, p));
          hits.push(`${chain.join(" → ").split(sep).join("/")} → ${spec}`);
          continue;
        }
        const next = resolveImport(f, spec);
        if (next && !seen.has(next)) {
          seen.set(next, f);
          queue.push(next);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
