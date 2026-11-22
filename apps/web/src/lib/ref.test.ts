import { describe, expect, it } from "vitest";
import { cleanRef, readRef, saveRef } from "./ref";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
};

describe("centre link code on the device (B113)", () => {
  it("keeps a clean code for 30 days", () => {
    const s = memory();
    const t0 = Date.UTC(2026, 10, 22);
    saveRef(" Dvijeniye ", t0, s);
    expect(readRef(t0 + 29 * 86_400_000, s)).toBe("dvijeniye");
    expect(readRef(t0 + 30 * 86_400_000, s)).toBeNull();
  });
  it("ignores what cannot be a code", () => {
    const s = memory();
    saveRef("<script>", 0, s);
    saveRef("", 0, s);
    expect(readRef(1, s)).toBeNull();
    expect(cleanRef("a")).toBeNull();
    expect(cleanRef("centre-2")).toBe("centre-2");
  });
  it("survives broken storage", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(() => saveRef("dvijeniye", 0, broken)).not.toThrow();
    expect(readRef(0, broken)).toBeNull();
  });
});
