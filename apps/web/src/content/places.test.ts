import { describe, expect, it } from "vitest";
import { needsFor, rankPlaces, samplePlaces } from "./places";

const NOW = Date.parse("2026-11-06T00:00:00Z");
const ALL = samplePlaces(NOW);
const ids = (wish: { place?: string[]; lang?: string[] }) => rankPlaces(ALL, { place: wish.place ?? [], lang: wish.lang ?? [] }).map((p) => p.id);
const original = ALL.map((p) => p.id);

describe("places and the parent's wishes (B75)", () => {
  it("no wish, or no preference, keeps the order", () => {
    expect(ids({})).toEqual(original);
    expect(ids({ place: ["any"], lang: ["any"] })).toEqual(original);
    expect(ids({ place: ["home_visits", "online"] })).toEqual(original); // no field in the places data yet
  });

  it("moves the places that fit up and takes none off the list", () => {
    expect(ids({ lang: ["en"] })[0]).toBe("pl_clinic_move"); // the only one with English
    expect(ids({ lang: ["en"] }).slice().sort()).toEqual(original.slice().sort());
    const state = ids({ place: ["state"] });
    expect(state.slice(0, 2)).toEqual(["pl_centre", "pl_polyclinic"]);
    expect(ids({ place: ["private"] })[0]).toBe("pl_clinic_speech");
  });

  it("free or low cost: the cheapest first, unknown prices last", () => {
    const cheap = ids({ place: ["low_cost"] });
    expect(cheap.slice(0, 3)).toEqual(["pl_centre", "pl_polyclinic", "pl_psych"]);
  });

  it("the new goals point to learning", () => {
    for (const g of ["memory", "attention", "literacy", "numeracy"] as const) expect(needsFor([g])[0]).toBe("learning");
  });
});
