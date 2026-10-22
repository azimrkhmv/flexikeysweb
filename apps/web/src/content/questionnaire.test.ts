import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mine from "./backend/questionnaire.json";
import { inLang, Q_BY_ID, QUESTIONNAIRE, shownOptions, visible, type QAnswers } from "./questionnaire";

// IQ1: the questionnaire file is the server's, and the cases below fix which questions each sample child is shown.
// questionnaire_cases.json (here and a copy in apps/api/tests) makes the server prove the same. Regenerate with
// UPDATE_BACKEND=1 npm test, then copy it to apps/api/tests/.
const TODAY = "2026-10-22";
const CASES: { name: string; answers: QAnswers }[] = [
  { name: "no answers yet", answers: {} },
  {
    name: "one-sided CP, walks alone (GMFCS I)",
    answers: { A2: "2019-05-01", B1: ["cp"], B3: "left_side", CP1: "spastic", CP2: "one_side", C10: "i", C3: "free_30min", C6: "alone_7m", D1: "ii", G1: ["sentences"], G2: "i", H7: "regular" },
  },
  {
    name: "CP, GMFCS V, cannot sit",
    answers: { A2: "2016-02-10", B1: ["cp"], CP1: "mixed", CP2: "whole_body", C10: "v", C3: "cant_sit", D1: "v", G1: ["face_crying"], G2: "iv", E1: "stiff", E3: "often" },
  },
  { name: "CP, GMFCS III", answers: { A2: "2018-09-01", B1: ["cp"], CP1: "ataxic", C10: "iii", C6: "walker_two_hands", D1: "iii" } },
  { name: "Down syndrome, age 3, cannot sit", answers: { A2: "2023-03-15", B1: ["down_syndrome"], C3: "cant_sit", C5: "cant", DS1: "not_checked" } },
  {
    name: "autism only, no motor problem",
    answers: { A2: "2020-01-20", B1: ["autism"], C3: "free_30min", C4: "crawls_stairs", C5: "alone_over_1min", C6: "alone_7m", E1: "normal", AU1: ["touch"], G1: ["sentences"] },
  },
  {
    name: "autism only, floppy muscles",
    answers: { A2: "2020-01-20", B1: ["autism"], C3: "free_30min", C4: "crawls_stairs", C5: "alone_over_1min", C6: "alone_7m", E1: "floppy" },
  },
  { name: "DCD at school, understood by others", answers: { A2: "2017-11-11", B1: ["dcd"], H7: "regular", G3: "mostly", B8: "yes", B6: "still" } },
  { name: "DCD, speech unclear", answers: { A2: "2017-11-11", B1: ["dcd"], G3: "rarely" } },
  { name: "delay and not sure", answers: { A2: "2022-06-01", B1: ["developmental_delay", "not_sure"], DD3: "yes" } },
  { name: "CP and autism, GMFCS II, MACS I", answers: { A2: "2019-01-01", B1: ["cp", "autism"], C10: "ii", D1: "i", D7: "not_yet", CP2: "legs" } },
  { name: "CP under 4, GMFCS II", answers: { A2: "2023-06-01", B1: ["cp"], C10: "ii", F5: ["glasses"] } },
];

const BACKEND = new URL("./backend/", import.meta.url);
const API_COPY = new URL("../../../api/tests/questionnaire_cases.json", import.meta.url);

describe("questionnaire (IQ1)", () => {
  it("is the server's file", () => {
    const server = JSON.parse(readFileSync(new URL("../../../api/app/content/questionnaire.json", import.meta.url), "utf8"));
    expect(mine).toEqual(server);
  });

  it("every rule points at a real question, option or named rule", () => {
    const walk = (c: unknown): void => {
      if (!c || typeof c !== "object") return;
      const o = c as Record<string, unknown>;
      if (typeof o.ref === "string") expect(QUESTIONNAIRE.defs, o.ref).toHaveProperty(o.ref);
      if (typeof o.q === "string") {
        expect(Q_BY_ID, o.q).toHaveProperty(o.q);
        for (const v of (o.in as string[] | undefined) ?? []) expect(Q_BY_ID[o.q].options, `${o.q}=${v}`).toContain(v);
      }
      Object.values(o).forEach((v) => (Array.isArray(v) ? v.forEach(walk) : walk(v)));
    };
    Object.values(QUESTIONNAIRE.defs).forEach(walk);
    for (const q of QUESTIONNAIRE.questions) {
      walk(q.show);
      walk(q.option_show);
      for (const o of Object.keys(q.option_show ?? {})) expect(q.options, `${q.id}.${o}`).toContain(o);
      if (q.options) expect(Object.keys(q.option_text!.en)).toEqual(q.options);
    }
  });

  it("every question, option and section has Uzbek and Russian text (IQ5)", () => {
    for (const lang of ["uz", "ru"]) {
      for (const s of QUESTIONNAIRE.steps) expect(QUESTIONNAIRE.step_text[lang]?.[s], `${lang} ${s}`).toBeTruthy();
      for (const q of QUESTIONNAIRE.questions) {
        expect(q.text[lang], `${lang} ${q.id}`).toBeTruthy();
        for (const o of q.options ?? []) expect(q.option_text?.[lang]?.[o], `${lang} ${q.id}.${o}`).toBeTruthy();
      }
    }
    expect(inLang(Q_BY_ID.A3.option_text!, "ru", "boy")).toBe(Q_BY_ID.A3.option_text!.ru.boy);
  });

  it("each sample child sees the right questions (shared with the server)", () => {
    const cases = CASES.map(({ name, answers }) => ({
      name,
      today: TODAY,
      answers,
      visible: visible(answers, TODAY),
      options: Object.fromEntries(
        QUESTIONNAIRE.questions.filter((q) => q.option_show).map((q) => [q.id, shownOptions(q.id, answers, TODAY)]),
      ),
    }));
    const json = `${JSON.stringify(cases, null, 1)}\n`;
    if (process.env.UPDATE_BACKEND) {
      writeFileSync(new URL("questionnaire_cases.json", BACKEND), json);
      writeFileSync(API_COPY, json);
    }
    expect(readFileSync(new URL("questionnaire_cases.json", BACKEND), "utf8")).toBe(json);
    expect(readFileSync(API_COPY, "utf8")).toBe(json);
  });

  it("follows the display rules", () => {
    const v = (name: string) => new Set(visible(CASES.find((c) => c.name === name)!.answers, TODAY));
    const cp1 = v("one-sided CP, walks alone (GMFCS I)");
    expect([...cp1].filter((id) => /^(DCD|DD|DS|AU)\d/.test(id))).toEqual([]); // only the CP module opens (R1)
    for (const id of ["CP15", "CP16", "CP17", "CP7", "C9", "C10", "D1", "G2"]) expect(cp1, id).toContain(id);
    for (const id of ["C1", "C13", "C14", "C16", "CP19", "G4"]) expect(cp1, id).not.toContain(id); // R8, R13
    const cp5 = v("CP, GMFCS V, cannot sit");
    for (const id of ["C7", "C8", "C9", "C21", "C22", "C23", "C24", "D11", "D12", "D13"]) expect(cp5, id).not.toContain(id); // R6, R10
    for (const id of ["CP19", "CP20", "CP21", "C1", "C13", "C14", "G4", "E4"]) expect(cp5, id).toContain(id);
    expect(v("CP, GMFCS III")).not.toContain("C9"); // R7
    const au = v("autism only, no motor problem");
    for (const id of ["C3", "C4", "C5", "C6", "C12", "E1", "AU8", "G2"]) expect(au, id).toContain(id);
    for (const id of ["C1", "C2", "C10", "C13", "C17", "D1", "D2", "D7"]) expect(au, id).not.toContain(id); // R5
    for (const id of ["C2", "C17", "D2", "D7"]) expect(v("autism only, floppy muscles"), id).toContain(id);
    const dcd = v("DCD at school, understood by others");
    for (const id of ["C1", "C3", "C10", "C13", "C18", "D1", "G2"]) expect(dcd, id).not.toContain(id); // R2
    for (const id of ["DCD6", "DCD9", "C6", "C9", "B6_often", "B8_type", "B8_date"]) expect(dcd, id).toContain(id);
    expect(v("DCD, speech unclear")).toContain("G2");
    const dd = v("delay and not sure");
    for (const id of ["DD1", "DD2", "DD3_files", "C3"]) expect(dd, id).toContain(id);
    for (const id of ["C10", "D1", "G2", "DD6"]) expect(dd, id).not.toContain(id); // R3
    const both = v("CP and autism, GMFCS II, MACS I");
    for (const id of ["C10", "D1", "C2", "AU1", "CP18", "CP1"]) expect(both, id).toContain(id); // two modules open
    expect(both).not.toContain("D8"); // R12
    const small = v("CP under 4, GMFCS II");
    for (const id of ["D11", "D12", "D13", "H7"]) expect(small, id).not.toContain(id); // R15
    expect(small).toContain("F5_help"); // R18
    const opts = (name: string, id: string) => shownOptions(id, CASES.find((c) => c.name === name)!.answers, TODAY);
    expect(opts("CP under 4, GMFCS II", "F3")).not.toContain("letters");
    expect(opts("CP under 4, GMFCS II", "C5")).not.toContain("stander"); // R8
    expect(opts("CP and autism, GMFCS II, MACS I", "D7")).not.toContain("with_help"); // R11
    expect(opts("CP, GMFCS V, cannot sit", "C5")).toContain("stander");
  });
});
