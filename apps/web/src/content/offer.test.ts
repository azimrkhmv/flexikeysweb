import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fmtUzs, freeEndsAt, needsPayReminder, OFFER } from "./offer";

describe("the offer (B114)", () => {
  const signed = "2026-11-01T10:00:00.000Z";
  it("gives 30 free days from the end of sign-up", () => {
    expect(OFFER).toEqual({ freeDays: 30, priceUzs: 299_000, periodMonths: 3 });
    expect(freeEndsAt(signed)).toBe("2026-12-01T10:00:00.000Z");
    expect(freeEndsAt(undefined)).toBeNull();
  });

  it("reminds only after the free month and only when unpaid", () => {
    const during = Date.parse("2026-11-20T00:00:00Z");
    const after = Date.parse("2026-12-02T00:00:00Z");
    expect(needsPayReminder(signed, undefined, during)).toBe(false);
    expect(needsPayReminder(signed, undefined, after)).toBe(true);
    expect(needsPayReminder(signed, "2027-03-01T00:00:00Z", after)).toBe(false);
    expect(needsPayReminder(signed, "2026-12-01T00:00:00Z", after)).toBe(true); // paid time over
    expect(needsPayReminder(undefined, undefined, after)).toBe(false);
  });

  it("writes sums with spaces", () => expect(fmtUzs(299000)).toBe("299 000"));
});

// Spec 5.1: nothing about payment on child screens (the child area as in messages/areas.test.ts).
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));

describe("child screens", () => {
  it("never import the offer, the reminder or the Help button", () => {
    const src = join(__dirname, "..");
    const child = ["app/play", "app/demo", "features/play", "features/activities"].flatMap((d) => files(join(src, d)));
    expect(child.length).toBeGreaterThan(10);
    const offenders = child.filter((f) => /content\/offer|features\/parent\/Offer|["'`](offer|pay)\.|help\.button/.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
