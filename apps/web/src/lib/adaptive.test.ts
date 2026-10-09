import { describe, expect, it } from "vitest";
import { applyPolicy, BOUNDS, DEFAULT_PROFILE, pressDecision, startingProfile } from "./adaptive";
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

  it("keeps motor and learning help apart", () => {
    // Precise taps, wrong answers: more hints, same key size.
    const wrong = applyPolicy(rec(), taps(12, false, 0.1)).record.params;
    expect(wrong.hintLevel).toBe(2);
    expect(wrong.keyScale).toBe(DEFAULT_PROFILE.keyScale);
    // Right answers, imprecise taps: bigger keys, hints don't fade.
    const imprecise = applyPolicy(rec(), taps(12, true, 0.5, 1200)).record.params;
    expect(imprecise.keyScale).toBe(1.1);
    expect(imprecise.hintLevel).toBe(DEFAULT_PROFILE.hintLevel - 1);
    // Keyboard/switch users have no geometry: sizes never move.
    const kb = taps(12, true, 0.1, 1200).map((e) => ({ ...e, pointerType: "keyboard" as const, offsetRatio: undefined }));
    expect(applyPolicy(rec({ ...DEFAULT_PROFILE, keyScale: 1.3 }), kb).record.params.keyScale).toBe(1.3);
  });

  it("never goes below adult-set floors", () => {
    let r = rec({ ...DEFAULT_PROFILE, dwellMs: 300 });
    for (let i = 0; i < 6; i++) r = applyPolicy(r, taps(12, true, 0.1, 1200), { dwellMs: 300, keyScale: 1.2 }).record; // calm, precise sessions
    expect(r.params.dwellMs).toBe(300);
    expect(r.params.keyScale).toBeGreaterThanOrEqual(1);
    expect(applyPolicy(rec({ ...DEFAULT_PROFILE, keyScale: 1.2 }), taps(12, true, 0.1, 1200), { keyScale: 1.2 }).record.params.keyScale).toBe(1.2);
  });

  it("starts children with severe hand or vision difficulties with more help", () => {
    expect(startingProfile()).toEqual(DEFAULT_PROFILE);
    const hands = startingProfile({ macs: 5 });
    expect(hands.dwellMs).toBeGreaterThan(0);
    expect(hands.targetScale).toBeGreaterThan(1);
    expect(startingProfile({ vfcs: 4 }).optionCount).toBe(2);
    expect(startingProfile({ floors: { debounceMs: 600 } }).debounceMs).toBe(600);
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
