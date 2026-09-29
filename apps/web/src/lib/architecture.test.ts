import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Pages and components read data only through `sel.*` (lib/api/selectors.ts), never the mock DB's tables.
// That keeps the switch to the real backend inside lib/api/ and every read behind one authorization rule.
const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });

describe("architecture", () => {
  it("UI code never reads mock DB tables directly", () => {
    const offenders = ["app", "features", "components"]
      .flatMap((d) => files(join(SRC, d)))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => (/\bdb\.(?!\w+\()[a-zA-Z]+\b/.test(line) ? `${f.slice(SRC.length)}:${i + 1}` : null))
          .filter((x): x is string => !!x),
      );
    expect(offenders).toEqual([]);
  });
});
