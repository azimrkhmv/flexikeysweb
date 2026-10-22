import { describe, expect, it } from "vitest";
import { missing, replaces, requiredFor, therapistInput } from "./therapist";

describe("therapist form (spec §6)", () => {
  it("requires T2, T6, T7, plus T3 for physio and OT and T4 for speech therapists", () => {
    expect(requiredFor("physio")).toEqual(["T2", "T3", "T6", "T7"]);
    expect(requiredFor("defectologist_ot")).toEqual(["T2", "T3", "T6", "T7"]);
    expect(requiredFor("speech")).toEqual(["T2", "T4", "T6", "T7"]);
    expect(requiredFor("neurologist")).toEqual(["T2", "T6", "T7"]);
  });

  it("counts empty answers as missing", () => {
    expect(missing({ T2: 3, T6: { items: [], text: " " }, T7: { goals: [], own: [""] } }, "neurologist")).toEqual(["T6", "T7"]);
    expect(missing({ T2: 3, T6: { items: ["nothing"], text: "" }, T7: { goals: [], own: ["Hold a spoon"] } }, "neurologist")).toEqual([]);
  });
});

describe("a therapist's answers replace the parent's", () => {
  const a = { T2: 3 as const, T5: { type: "spastic", parts: null }, T6: { items: ["jumping"], text: "No stairs" }, T7: { goals: ["walk"], own: [] }, T11: "Hi" };
  it("maps T2, T5, T6 and T7 to the parent questions", () => {
    expect(replaces(a, true)).toEqual({ P12: "walker", P10: "spastic", P14: ["jumping", "other"], _hold: [], _restrictions: [], P33: ["walk"] }); // T6 also ends the red flags (IQ6)
  });
  it("leaves out health answers without the health consent", () => {
    expect(replaces(a, false)).toEqual({ P33: ["walk"] });
  });
});

describe("what the therapists set, for the plan", () => {
  it("uses the newest level and goals, every restriction and exclusion, and an exclusion beats an assignment", () => {
    const older = { T2: 2 as const, T6: { items: ["jumping"], text: "" }, T7: { goals: ["walk"], own: [] }, T8: { assign: ["a", "b"], exclude: [] } };
    const newer = { T2: 4 as const, T6: { items: ["prone", "nothing"], text: "" }, T8: { assign: [], exclude: ["b"] } };
    expect(therapistInput([older, newer], true)).toEqual({
      gmfcs: 4, restrictions: ["jumping", "prone"], goals: ["walk"], assign: ["a"], exclude: ["b"], legBalanceApproved: false,
    });
    expect(therapistInput([older], false)).toMatchObject({ gmfcs: undefined, restrictions: [] });
    expect(therapistInput([], true)).toBeUndefined();
  });
});
