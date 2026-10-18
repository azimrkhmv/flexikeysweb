import { describe, expect, it } from "vitest";
import { missing, requiredFor } from "./therapist";

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
