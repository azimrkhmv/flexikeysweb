import { describe, expect, it } from "vitest";
import { applyPolicy, BOUNDS, DEFAULT_PROFILE, pressDecision } from "./adaptive";
import type { InteractionEvent, ProfileRecord } from "./types";

const rec = (params = DEFAULT_PROFILE): ProfileRecord => ({ childId: "c", input: "touch", params: { ...params }, version: 1, lastDir: {}, updatedAt: "" });
const taps = (n: number, correct: boolean, offsetRatio: number, latencyMs = 1500): InteractionEvent[] =>
  Array.from({ length: n }, (_, i) => ({ sessionId: "s", t: i * 1000, type: "select", correct, offsetRatio, latencyMs, pointerType: "touch" }));

describe("pressDecision (FR-KBD-2, FR-KBD-3)", () => {
  const p = { dwellMs: 300, debounceMs: 250 };
  it("rejects presses shorter than dwell as accidental", () => expect(pressDecision(120, null, p)).toBe("accidental"));
  it("accepts a long enough press", () => expect(pressDecision(320, null, p)).toBe("accept"));
  it("debounces repeats inside the window", () => expect(pressDecision(400, 100, p)).toBe("debounced"));
  it("plain taps when dwell is 0", () => expect(pressDecision(10, 1000, { dwellMs: 0, debounceMs: 250 })).toBe("accept"));
});

describe("applyPolicy", () => {
  it("helps a struggling child by exactly one step per param (FR-ADAPT-3)", () => {
    const { record, changes } = applyPolicy(rec(), taps(12, false, 0.5));
    expect(record.params.keyScale).toBe(1.1);
    expect(record.params.hintLevel).toBe(2);
    expect(record.params.optionCount).toBe(2);
    for (const c of changes) expect(Math.abs(c.to - c.from)).toBeCloseTo(BOUNDS[c.param][2]);
  });

  it("returns help to baseline after sustained mastery — no ratchet (FR-ADAPT-1, B5)", () => {
    let r = rec();
    for (let i = 0; i < 4; i++) r = applyPolicy(r, taps(12, false, 0.5)).record; // help rises
    expect(r.params.keyScale).toBeGreaterThan(1.2);
    for (let i = 0; i < 12; i++) r = applyPolicy(r, taps(12, true, 0.1, 1200)).record; // mastery
    expect(r.params.keyScale).toBe(DEFAULT_PROFILE.keyScale);
    expect(r.params.hintLevel).toBe(0);
    expect(r.params.targetScale).toBe(1);
  });

  it("blocks the opposite direction only for a limited number of sessions", () => {
    let r = applyPolicy(rec(), taps(12, false, 0.5)).record;
    const up = r.params.keyScale;
    r = applyPolicy(r, taps(12, true, 0.1)).record; // blocked
    expect(r.params.keyScale).toBe(up);
    r = applyPolicy(r, taps(12, true, 0.1)).record; // still blocked (2 sessions)
    r = applyPolicy(r, taps(12, true, 0.1)).record; // free
    expect(r.params.keyScale).toBeLessThan(up);
  });

  it("does nothing with too little data", () => {
    expect(applyPolicy(rec(), taps(3, false, 0.9)).changes).toHaveLength(0);
  });

  it("successful answers without touch geometry (e.g. path tracing) never add size help", () => {
    const ev = taps(12, true, 0).map((e) => ({ ...e, offsetRatio: undefined }));
    const { record } = applyPolicy(rec(), ev);
    expect(record.params.keyScale).toBe(DEFAULT_PROFILE.keyScale);
    expect(record.params.spacing).toBe(DEFAULT_PROFILE.spacing);
    expect(record.params.traceTolerance).toBeLessThanOrEqual(DEFAULT_PROFILE.traceTolerance);
  });

  it("ignores mouse geometry for spacing", () => {
    const ev = taps(12, true, 0.9).map((e) => ({ ...e, pointerType: "mouse" as const }));
    expect(applyPolicy(rec(), ev).changes.find((c) => c.param === "spacing")).toBeUndefined();
  });
});
