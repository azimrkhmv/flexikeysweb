import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persisted } from "./store";

// Minimal browser stand-ins: one shared localStorage, a window that can dispatch `storage` events.
const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

const storageEvent = (key: string, newValue: string | null) => Object.assign(new Event("storage"), { key, newValue });

describe("persisted", () => {
  it("picks up another tab's write instead of keeping a stale copy", () => {
    const tabA = persisted("k", { n: 0 });
    const seen = vi.fn();
    tabA.subscribe(seen);
    mem.set("k", JSON.stringify({ n: 5 }));
    window.dispatchEvent(storageEvent("k", JSON.stringify({ n: 5 })));
    expect(tabA.get()).toEqual({ n: 5 });
    expect(seen).toHaveBeenCalledOnce();
    tabA.set((p) => ({ n: p.n + 1 }));
    expect(JSON.parse(mem.get("k")!)).toEqual({ n: 6 }); // builds on the other tab's value
  });

  it("ignores other keys", () => {
    const s = persisted("k", { n: 0 });
    s.subscribe(() => {});
    window.dispatchEvent(storageEvent("other", "{}"));
    expect(s.get()).toEqual({ n: 0 });
  });

  it("falls back to the initial value when stored data has an old shape", () => {
    mem.set("k", JSON.stringify({ v: 0, n: 9 }));
    const s = persisted("k", { v: 1, n: 0 }, { accept: (d) => d.v === 1 });
    expect(s.get()).toEqual({ v: 1, n: 0 });
  });

  it("falls back on corrupt JSON", () => {
    mem.set("k", "{not json");
    expect(persisted("k", { n: 1 }).get()).toEqual({ n: 1 });
  });
});
