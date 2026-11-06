import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mine from "./backend/questionnaire.json";
import { intake } from "@/messages/intake";
import { bodyPattern, cmFromFtIn, cpType, ftInFromCm, homeLanguage, inLang, kgFromLb, ladderTicks, ladderToggle, ladderValue, lbFromKg, offersNotSure, Q_BY_ID, QUESTIONNAIRE, shownOptions, typedProblem, upgrade, visible, type QAnswer, type QAnswers } from "./questionnaire";

// IQ1: the questionnaire file is the server's, and the cases below fix which questions each sample child is shown.
// questionnaire_cases.json (here and a copy in apps/api/tests) makes the server prove the same. Regenerate with
// UPDATE_BACKEND=1 npm test, then copy it to apps/api/tests/.
const TODAY = "2026-10-22";
const CASES: { name: string; answers: QAnswers }[] = [
  { name: "no answers yet", answers: {} },
  {
    name: "one-sided CP, walks alone (GMFCS I)",
    answers: { A2: "2019-05-01", B1: ["cp"], B3_parts: ["left_arm", "left_leg"], CP1: "spastic", CP2: "one_side", C10: "i", C3: "free_30min", C6: "alone_7m", D1: "ii", G1: ["sentences"], G2: "i", H7: "regular" },
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
  { name: "old round: B3 right side", answers: { A2: "2019-05-01", B1: ["cp"], B3: "right_side" } },
  { name: "right arm and back", answers: { A2: "2019-05-01", B1: ["cp"], B3_parts: ["right_arm", "trunk"] } },
  { name: "both legs and the back", answers: { A2: "2019-05-01", B1: ["cp"], B3_parts: ["left_leg", "right_leg", "trunk"] } },
  {
    // B68: "with hands under 10 s" and "alone a few minutes" ticked on C3 save the hardest; C6 "can't" alone.
    name: "step questions ticked, own words",
    answers: { A2: "2020-04-01", B1: ["cp"], C3: "free_few_min", C3_note: "Sits in her chair with a belt", C6: "doesnt_step", C10: "iii" },
  },
  // B69: several CP types ticked; CP14 (speech) shows in G only for ataxic or mixed CP and a child who uses words.
  { name: "CP types: spastic and dyskinetic, sentences", answers: { A2: "2023-03-01", B1: ["cp"], CP1_types: ["spastic", "dyskinetic"], C10: "v", C3: "cant_sit", G1: ["sentences"] } },
  { name: "CP types: spastic and dyskinetic, no words", answers: { A2: "2023-03-01", B1: ["cp"], CP1_types: ["spastic", "dyskinetic"], C10: "v", C3: "cant_sit", G1: ["face_crying"] } },
  { name: "CP types: spastic only, sentences", answers: { A2: "2019-05-01", B1: ["cp"], CP1_types: ["spastic"], G1: ["sentences"] } },
  { name: "CP types: don't know", answers: { A2: "2019-05-01", B1: ["cp"], CP1_types: ["dont_know"], G1: ["single_words"] } },
  // B70: E6_where opens for a sore now, a sore often, or an old round's E6.
  { name: "skin: a sore now", answers: { A2: "2019-05-01", B1: ["cp"], E6_now: "yes", E6_often: "no" } },
  { name: "skin: sores often", answers: { A2: "2019-05-01", B1: ["cp"], E6_now: "no", E6_often: "yes" } },
  { name: "skin: no sores", answers: { A2: "2019-05-01", B1: ["cp"], E6_now: "no", E6_often: "no" } },
  { name: "old round: E6 yes", answers: { A2: "2019-05-01", B1: ["cp"], E6: "yes" } },
  // B72: the home language from the languages ticked, or an old round's A7.
  { name: "home: one language", answers: { A7_langs: ["en"] } },
  { name: "home: two languages", answers: { A7_langs: ["uzbek", "russian"] } },
  { name: "home: other and russian", answers: { A7_langs: ["other", "russian"] } },
  { name: "home: only other", answers: { A7_langs: ["other"] } },
  { name: "old round: A7 russian", answers: { A7: "russian" } },
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
      if (typeof o.q === "string" && o.q === "E6") {
        expect(o.in).toEqual(["yes"]); // retired (B70); E6_where still opens for an old round's "yes"
      } else if (typeof o.q === "string") {
        expect(Q_BY_ID, o.q).toHaveProperty(o.q);
        const known = [...(Q_BY_ID[o.q].options ?? []), ...Object.keys(Q_BY_ID[o.q].retired_options ?? {})]; // old answers still match (B61)
        for (const v of (o.in as string[] | undefined) ?? []) expect(known, `${o.q}=${v}`).toContain(v);
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
      for (const s of QUESTIONNAIRE.steps) expect(QUESTIONNAIRE.step_intro[lang]?.[s], `intro ${lang} ${s}`).toBeTruthy(); // B67
      for (const q of QUESTIONNAIRE.questions) {
        expect(q.text[lang], `${lang} ${q.id}`).toBeTruthy();
        for (const o of q.options ?? []) expect(q.option_text?.[lang]?.[o], `${lang} ${q.id}.${o}`).toBeTruthy();
      }
    }
    expect(inLang(Q_BY_ID.A3.option_text!, "ru", "boy")).toBe(Q_BY_ID.A3.option_text!.ru.boy);
  });

  it("no question shows two answers with the same text, counting the automatic \"Not sure\" (B66)", () => {
    for (const lang of ["en", "uz", "ru"] as const) {
      for (const q of QUESTIONNAIRE.questions) {
        const texts = (q.options ?? []).map((o) => inLang(q.option_text!, lang, o).trim().toLowerCase());
        if (q.options && offersNotSure(q)) texts.push(intake[lang]["intake.notSure"].toLowerCase());
        expect(texts.filter((x, k) => texts.indexOf(x) !== k), `${lang} ${q.id}`).toEqual([]);
      }
    }
    for (const id of ["CP1_types", "DS1", "E1"]) expect(offersNotSure(Q_BY_ID[id]), id).toBe(false); // their own "Don't know"
    expect(offersNotSure(Q_BY_ID.B5)).toBe(true); // keeps both (30 Oct), worded differently in uz
    expect(upgrade({ DS1: null, C3: null })).toEqual({ DS1: "dont_know", C3: null }); // an older round's "Not sure"
  });

  it("step-by-step questions: tick everything, the hardest one is saved (B68)", () => {
    const ladders = QUESTIONNAIRE.questions.filter((q) => q.ladder).map((q) => q.id);
    expect(ladders.sort()).toEqual(["C14", "C17", "C19", "C2", "C3", "C4", "C5", "C6"]);
    for (const id of ladders) {
      const q = Q_BY_ID[id];
      expect(q.kind, id).toBe("single"); // one answer in the data: rules, bridge and old answers unchanged
      const note = QUESTIONNAIRE.questions[QUESTIONNAIRE.questions.indexOf(q) + 1];
      expect(note.id, id).toBe(`${id}_note`); // its "own words" box right after it, shown with it
      expect([note.kind, note.required, note.step, note.show, note.health]).toEqual(["text", false, q.step, q.show, q.health]);
      expect(q.hint?.en).toBe("Tick everything your child can do. We use the hardest one.");
    }
    const C3 = Q_BY_ID.C3.options!; // cant_sit, hands_under_10s, hands_5min, free_few_min, free_30min
    // A ticked set and the answer saved for it.
    const tap = (...taps: string[]) => taps.reduce((t, o) => ladderToggle(C3, t, o), [] as string[]);
    expect(ladderValue(C3, tap("hands_under_10s", "free_few_min"))).toBe("free_few_min");
    expect(ladderValue(C3, tap("free_few_min", "hands_under_10s"))).toBe("free_few_min"); // order of taps doesn't matter
    expect(ladderValue(C3, tap("hands_under_10s", "free_few_min", "free_few_min"))).toBe("hands_under_10s"); // untick: worked out again
    expect(ladderValue(C3, tap("hands_under_10s", "hands_under_10s"))).toBeUndefined(); // nothing ticked: no answer
    // "Can't sit" stands alone: it clears the others, and any other box clears it.
    expect(tap("hands_under_10s", "hands_5min", "cant_sit")).toEqual(["cant_sit"]);
    expect(tap("cant_sit", "hands_5min")).toEqual(["hands_5min"]);
    expect(ladderValue(C3, tap("cant_sit"))).toBe("cant_sit");
    // A saved answer ticks itself and every box before it, never "can't".
    expect(ladderTicks(C3, "hands_5min")).toEqual(["hands_under_10s", "hands_5min"]);
    expect(ladderTicks(C3, "cant_sit")).toEqual(["cant_sit"]);
    expect(ladderTicks(C3, null)).toEqual([]); // "Not sure"
    expect(ladderTicks(C3, undefined)).toEqual([]);
    for (const o of C3) expect(ladderValue(C3, ladderTicks(C3, o))).toBe(o); // a saved answer loads and saves unchanged
    const C5 = shownOptions("C5", { A2: "2019-05-01", B1: ["cp"], C10: "i" }, TODAY)!; // a hidden option is skipped
    expect(ladderTicks(C5, "one_hand")).toEqual(C5.slice(1, C5.indexOf("one_hand") + 1));
  });

  it("several CP types can be ticked; the rules read cp_type (B69)", () => {
    expect(Q_BY_ID.CP1).toBeUndefined(); // retired, its id never reused
    expect(Q_BY_ID.CP1_types).toMatchObject({ kind: "multi", required: true, health: true, exclusive: "dont_know" });
    expect(JSON.stringify(QUESTIONNAIRE)).not.toContain('"q":"CP1"'); // every rule reads the fact
    const t = (...types: string[]) => cpType({ CP1_types: types });
    expect(t("spastic")).toBe("spastic");
    expect(t("ataxic")).toBe("ataxic");
    expect(t("spastic", "dyskinetic")).toBe("mixed");
    expect(t("mixed")).toBe("mixed");
    expect(t("dyskinetic", "mixed")).toBe("mixed");
    expect(t("dont_know")).toBe("dont_know");
    expect(cpType({ CP1: "ataxic" })).toBe("ataxic"); // an old round
    expect(cpType({ CP1: "ataxic", CP1_types: ["spastic"] })).toBe("spastic");
    expect(cpType({ CP1_types: null })).toBeNull(); // "Not sure"
    expect(cpType({})).toBeNull();
    expect(upgrade({ CP1: "dyskinetic" })).toEqual({ CP1: "dyskinetic", CP1_types: ["dyskinetic"] }); // an open old round
    expect(upgrade({ CP1_types: null })).toEqual({ CP1_types: ["dont_know"] });
    // CP14 (speech) moved to "Talking and understanding", right after G1.
    const ids = QUESTIONNAIRE.questions.map((q) => q.id);
    expect(Q_BY_ID.CP14.step).toBe("G");
    expect(ids[ids.indexOf("G1") + 1]).toBe("CP14");
  });

  it("each sample child sees the right questions (shared with the server)", () => {
    const cases = CASES.map(({ name, answers }) => ({
      name,
      today: TODAY,
      answers,
      visible: visible(answers, TODAY),
      home: Object.fromEntries(["uz", "ru", "en"].map((ui) => [ui, homeLanguage(answers, ui)])),
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

  it("refuses the dates and numbers the server refuses (B60)", () => {
    const p = (id: string, v: QAnswer) => typedProblem(Q_BY_ID[id], v, {}, TODAY);
    expect(p("A2", "2018-02-27")).toBeNull();
    expect(p("A2", "2018-02-31")).toBe("not_a_date");
    expect(p("A2", "0001-02-27")).toBe("age_out_of_range");
    expect(p("A2", "2099-01-01")).toBe("date_in_future");
    expect(p("A2", "2025-06-01")).toBe("age_out_of_range"); // 1 year old
    expect(p("A2", "2007-10-23")).toBeNull(); // still 18 until tomorrow
    expect(p("A2", "2007-10-22")).toBe("age_out_of_range"); // 19 today
    expect(p("A2", "2024-10-22")).toBeNull(); // 2 today
    expect(p("A4", 29)).toBe("out_of_range");
    expect(p("A4", 30)).toBeNull(); // B72: 30-250 cm, 5-200 kg
    expect(p("A4", 250)).toBeNull();
    expect(p("A4", 251)).toBe("out_of_range");
    expect(p("A4", 104.5)).toBeNull();
    expect(p("A4_kg", 4.9)).toBe("out_of_range");
    expect(p("A4_kg", 200)).toBeNull();
    expect(p("A4_kg", 201)).toBe("out_of_range");
    expect(p("B8_date", "2026-01-10")).toBeNull();
  });

  it("height and weight in US units are saved as cm and kg (B72)", () => {
    const p = (id: string, v: number) => typedProblem(Q_BY_ID[id], v, {}, TODAY);
    expect(cmFromFtIn(5, 7)).toBe(170);
    expect(kgFromLb(100)).toBe(45.4);
    // The ends of the range the message names pass; one step outside does not.
    for (const [ft, inches] of [[1, 0], [8, 2]]) expect(p("A4", cmFromFtIn(ft, inches)), `${ft} ft ${inches} in`).toBeNull();
    expect(p("A4", cmFromFtIn(0, 11))).toBe("out_of_range");
    expect(p("A4", cmFromFtIn(8, 3))).toBe("out_of_range");
    for (const lb of [11, 440]) expect(p("A4_kg", kgFromLb(lb)), `${lb} lb`).toBeNull();
    expect(p("A4_kg", kgFromLb(10))).toBe("out_of_range");
    expect(p("A4_kg", kgFromLb(442))).toBe("out_of_range");
    // A saved answer shows what the parent typed, at every step of the range.
    for (let ft = 1; ft <= 8; ft++) for (let inches = 0; inches < 12; inches++) expect(ftInFromCm(cmFromFtIn(ft, inches))).toEqual({ ft, inches });
    for (let lb = 11; lb <= 440; lb++) expect(lbFromKg(kgFromLb(lb))).toBe(lb);
  });

  it("the home language comes from the languages ticked (B72)", () => {
    expect(Q_BY_ID.A7).toBeUndefined(); // retired, its id never reused
    expect(Q_BY_ID.A7_langs).toMatchObject({ kind: "multi", required: true, step: "A", feeds: ["MV"] });
    expect(offersNotSure(Q_BY_ID.A7_langs)).toBe(false);
    const h = (ui: string, ...langs: string[]) => homeLanguage({ A7_langs: langs }, ui);
    expect(h("en", "russian")).toBe("ru"); // one ticked: that one, whatever the app's language
    expect(h("ru", "en")).toBe("en");
    expect(h("ru", "uzbek", "russian")).toBe("ru"); // several: the app's language if it is ticked
    expect(h("en", "uzbek", "russian")).toBe("uz"); // otherwise the first of uz, ru, en
    expect(h("uz", "en", "russian")).toBe("ru");
    expect(h("en", "other", "russian")).toBe("ru");
    expect(h("en", "other")).toBe("other");
    expect(homeLanguage({ A7: "russian" }, "uz")).toBe("ru"); // an old round
    expect(homeLanguage({ A7: "other" }, "uz")).toBe("other");
    expect(homeLanguage({ A7: "russian", A7_langs: ["en"] }, "uz")).toBe("en");
    expect(homeLanguage({}, "uz")).toBeNull();
    expect(upgrade({ A7: "uzbek" })).toEqual({ A7: "uzbek", A7_langs: ["uzbek"] }); // an open old round
  });

  it("refuses an age in months larger than the child's age (B61)", () => {
    const born = { A2: "2019-05-01" }; // 89 months old on TODAY
    expect(typedProblem(Q_BY_ID.B4, 90, born, TODAY)).toBe("older_than_child");
    expect(typedProblem(Q_BY_ID.B4, 89, born, TODAY)).toBeNull();
    expect(typedProblem(Q_BY_ID.DD2_walk, "not_yet", born, TODAY)).toBeNull();
    expect(typedProblem(Q_BY_ID.DD2, 300, {}, TODAY)).toBeNull(); // no date of birth: nothing to compare
  });

  it("shows old answers in today's options (B61, B62)", () => {
    expect(upgrade({ C7: "7_100m", B1: ["not_sure", "cp"], C3: "cant_sit" })).toEqual({ C7: "home", B1: ["not_sure", "cp"], C3: "cant_sit" });
    expect(Q_BY_ID.B1.options).not.toContain("not_sure");
  });

  it("works out the body pattern from the parts ticked (B61)", () => {
    const p = (parts: string[]) => bodyPattern({ B3_parts: parts });
    expect(p(["right_arm"])).toBe("right_side");
    expect(p(["right_arm", "right_leg", "face_mouth"])).toBe("right_side");
    expect(p(["left_leg"])).toBe("left_side");
    expect(p(["left_leg", "right_leg"])).toBe("mostly_legs");
    expect(p(["left_leg", "right_leg", "left_arm"])).toBe("three_limbs");
    expect(p(["left_leg", "right_leg", "left_arm", "right_arm"])).toBe("whole_body");
    expect(p(["left_leg", "right_leg", "trunk"])).toBe("whole_body");
    expect(p(["trunk"])).toBe("whole_body");
    expect(p(["face_mouth"])).toBe("whole_body");
    expect(p(["none"])).toBeNull();
    expect(bodyPattern({})).toBeNull();
    expect(bodyPattern({ B3: "left_side" })).toBe("left_side"); // an old round's answer
    for (const name of ["one-sided CP, walks alone (GMFCS I)", "old round: B3 right side", "right arm and back"]) {
      expect(visible(CASES.find((c) => c.name === name)!.answers, TODAY), name).toContain("CP15"); // ONE_SIDE
    }
    expect(visible(CASES.find((c) => c.name === "both legs and the back")!.answers, TODAY)).not.toContain("CP15");
  });

  it("follows the display rules", () => {
    const v = (name: string) => new Set(visible(CASES.find((c) => c.name === name)!.answers, TODAY));
    const cp1 = v("one-sided CP, walks alone (GMFCS I)");
    expect([...cp1].filter((id) => /^(DCD|DD|DS|AU)\d/.test(id))).toEqual([]); // only the CP module opens (R1)
    for (const id of ["CP15", "CP16", "CP17", "CP7", "C9", "C10", "D1", "G2"]) expect(cp1, id).toContain(id);
    for (const id of ["C1", "C13", "C14", "C16", "CP19", "G4"]) expect(cp1, id).not.toContain(id); // R8, R13
    const cp5 = v("CP, GMFCS V, cannot sit");
    for (const id of ["C7", "C8", "C9", "C21", "C22", "C23", "C24", "D11", "D12_spoon", "D12_cup", "D13_buttons", "D13_zip"]) expect(cp5, id).not.toContain(id); // R6, R10
    for (const id of ["CP19", "CP20", "CP21", "C1", "C13", "C14", "G4", "E4"]) expect(cp5, id).toContain(id);
    expect(v("CP, GMFCS III")).not.toContain("C9"); // R7
    const au = v("autism only, no motor problem");
    for (const id of ["C3", "C5", "C6", "C12", "E1", "AU8", "G2"]) expect(au, id).toContain(id);
    expect(au).not.toContain("C4"); // walks alone: no crawling question (B62)
    expect(v("Down syndrome, age 3, cannot sit")).toContain("C4");
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
    for (const id of ["C10", "D1", "C2", "AU1", "CP18", "CP1_types"]) expect(both, id).toContain(id); // two modules open
    expect(both).not.toContain("D8"); // R12
    const small = v("CP under 4, GMFCS II");
    for (const id of ["D11", "D12_spoon", "D12_cup", "D13_buttons", "D13_zip", "H7"]) expect(small, id).not.toContain(id); // R15
    expect(small).toContain("F5_help"); // R18
    for (const id of ["D13_buttons", "D13_zip", "E6_now", "E6_often", "H5_calm", "H5_active", "J9_other"]) expect(cp1, id).toContain(id); // B70
    for (const id of ["D13", "E6", "H5"]) expect(Q_BY_ID[id], id).toBeUndefined(); // retired, ids never reused
    expect(v("skin: a sore now")).toContain("E6_where");
    expect(v("skin: sores often")).toContain("E6_where");
    expect(v("old round: E6 yes")).toContain("E6_where");
    expect(v("skin: no sores")).not.toContain("E6_where");
    const opts = (name: string, id: string) => shownOptions(id, CASES.find((c) => c.name === name)!.answers, TODAY);
    expect(opts("CP under 4, GMFCS II", "F3")).not.toContain("letters");
    expect(opts("CP under 4, GMFCS II", "C5")).not.toContain("stander"); // R8
    expect(opts("CP and autism, GMFCS II, MACS I", "D7")).not.toContain("with_help"); // R11
    expect(opts("CP, GMFCS V, cannot sit", "C5")).toContain("stander");
  });
});
