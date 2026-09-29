import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { areaMessages as m } from "./index";

// Each route area registers only its own catalogs (public / child / adult). This checks that every literal
// t("…") key used by an area's code exists in the catalogs that area registers — otherwise a raw key would show.
const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (p: string): string[] => {
  const full = join(SRC, p);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((f) => files(join(p, f))).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
};
const keysUsed = (paths: string[]) =>
  new Set(paths.flatMap(files).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\bt\("([a-z][\w]*\.[\w.]+)"/g)].map((x) => x[1])));

const AREAS: [string, string[], Record<string, string>[]][] = [
  ["public", ["app/[locale]", "features/marketing"], [m.common.en, m.marketing.en]],
  ["child", ["app/play", "app/class", "app/demo", "features/play", "features/activities"], [m.common.en, m.play.en, m.activities.en, m.aac.en]],
  ["adult", ["app/(auth)", "app/parent", "app/teacher", "app/therapist", "app/admin", "features/parent", "features/pro", "features/auth", "components/AppShell.tsx"], [m.common.en, m.auth.en, m.parent.en, m.pro.en]],
  ["shared components & error pages", ["components/ui.tsx", "components/brand.tsx", "components/StatusPage.tsx", "app/not-found.tsx", "app/error.tsx", "app/global-error.tsx"], [m.common.en]],
];

describe("per-area catalogs", () => {
  for (const [name, paths, catalogs] of AREAS)
    it(`${name}: every t("…") key is registered for that area`, () => {
      const used = keysUsed(paths);
      expect(used.size).toBeGreaterThan(5); // the scan really finds keys
      const missing = [...used].filter((k) => !catalogs.some((c) => k in c));
      expect(missing).toEqual([]);
    });
});
