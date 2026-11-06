import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mine from "./backend/questionnaire.json";
import { intake } from "@/messages/intake";
import { bodyPattern, cmFromFtIn, cpType, effectiveAnswers, ftInFromCm, homeLanguage, inLang, kgFromLb, ladderTicks, ladderToggle, ladderValue, lbFromKg, offersNotSure, Q_BY_ID, QUESTIONNAIRE, quickCheckDefaults, quickCheckOn, shownOptions, toggleOption, typedProblem, typicalFilled, upgrade, visible, type QAnswer, type QAnswers } from "./questionnaire";

// IQ1: the questionnaire file is the server's, and the cases below fix which questions each sample child is shown.
// questionnaire_cases.json (here and a copy in apps/api/tests) makes the server prove the same. Regenerate with
// UPDATE_BACKEND=1 npm test, then copy it to apps/api/tests/.
const TODAY = "2026-10-22";
const QC_IDS = ["QC_move", "QC_hands", "QC_body", "QC_senses", "QC_talk", "QC_daily"];
const QC_ALL = (v: string): QAnswers => Object.fromEntries(QC_IDS.map((id) => [id, v]));
// The personas of the 5 Nov review: only what is needed to place each child; the rest of the answers do not change what shows.
const M: QAnswers = { ...QC_ALL("none"), QC_body: "some", QC_talk: "some", A2: "2016-05-01", A3: "girl", B1: ["developmental_delay"], B3_parts: ["face_mouth"], B7: ["intellectual"], B6: "no", B8: "no", DD3: "no", E1: "normal", E3: "never", E6_now: "no", E7: "no", E13: "no", I1: ["none"], J9: ["memory", "speech"], G1: ["single_words"] };
const W: QAnswers = { ...QC_ALL("none"), QC_talk: "a_lot", A2: "2011-05-01", A3: "boy", B1: ["developmental_delay"], B3_parts: ["none"], B6: "no", B8: "no", DD3: "no", E7: "no", E13: "no", I1: ["none"], G1: ["sentences"] };
const S: QAnswers = { ...QC_ALL("a_lot"), A2: "2023-05-01", B1: ["cp"], B3_parts: ["left_arm", "right_arm", "left_leg", "right_leg", "trunk"], CP1_types: ["spastic", "dyskinetic"], C10: "v", C3: "cant_sit", C5: "cant", C6: "doesnt_step", G1: ["face_crying"], B6: "no", B8: "no", CP3: "no", E1: "stiff", E3: "sometimes", E7: "no", E13: "no", I1: ["physio"] };

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
  // B74: `always` counts like `mostly` (no G2 for a DCD child); an old answer with both of a pair counts as "by themselves".
  { name: "DCD, always understood", answers: { A2: "2017-11-11", B1: ["dcd"], G3: "always" } },
  { name: "old round: both of a pair ticked", answers: { A2: "2019-05-01", B1: ["cp"], C22: ["turns", "backward_help", "backward_alone"], C24: ["step_over_help", "step_over_alone", "grass"] } },
  { name: "only with help", answers: { A2: "2019-05-01", B1: ["cp"], C22: ["backward_help"], C24: ["step_over_help"] } },
  // B75: an old I8 answer shows as I8_place and I8_lang.
  { name: "old round: I8", answers: { I8: ["state", "private", "uzbek_doctor", "russian_doctor"] } },
  { name: "old round: I8, place only", answers: { I8: ["private"] } },
  { name: "I8 replaced", answers: { I8: ["state"], I8_lang: ["en"] } },
  // B76: the Quick check, typical answers, the baby-level and age hiding, and old rounds.
  { name: "qc: persona M", answers: M },
  { name: "qc: persona W", answers: W },
  { name: "qc: persona S", answers: S },
  { name: "qc: walks alone, short version", answers: { ...QC_ALL("some"), A2: "2011-03-01", B1: ["dcd"], C6: "alone_7m" } },
  { name: "qc: stands alone, a lot", answers: { ...QC_ALL("a_lot"), A2: "2016-03-01", B1: ["developmental_delay"], C5: "alone_10_60s" } },
  { name: "qc: walks with a walker, a lot", answers: { ...QC_ALL("a_lot"), A2: "2016-03-01", B1: ["developmental_delay"], C6: "walker_two_hands" } },
  { name: "qc: CP, no difficulty moving", answers: { ...QC_ALL("none"), A2: "2016-03-01", B1: ["cp"], CP1_types: ["spastic"] } },
  { name: "qc: a parent's answer beats typical", answers: { ...QC_ALL("none"), A2: "2016-03-01", B1: ["dcd"], C6: "one_hand", F6: "hard", E3: null } },
  { name: "qc: 2-year-old, no difficulty", answers: { ...QC_ALL("none"), A2: "2024-06-01", B1: ["other"] } },
  { name: "qc: 5-year-old with delay", answers: { ...QC_ALL("a_lot"), A2: "2021-06-01", B1: ["developmental_delay"] } },
  { name: "qc: just turned 6, delay", answers: { ...QC_ALL("a_lot"), A2: "2020-10-22", B1: ["developmental_delay"] } },
  { name: "qc: started, not answered", answers: { A2: "2016-03-01", B1: ["dcd"], B3_parts: ["none"] } },
  { name: "qc: old round, older than 6, walks alone", answers: { A2: "2016-03-01", B1: ["developmental_delay"], B3_parts: ["none"], C6: "alone_7m" } },
];

const BACKEND = new URL("./backend/", import.meta.url);
const API_COPY = new URL("../../../api/tests/questionnaire_cases.json", import.meta.url);
const byOrder = (x: string, y: string) => QUESTIONNAIRE.questions.findIndex((q) => q.id === x) - QUESTIONNAIRE.questions.findIndex((q) => q.id === y);

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
      upgraded: Object.fromEntries(["A7_langs", "C22", "C24", "I8_place", "I8_lang"].flatMap((id) => { const v = upgrade(answers)[id]; return v === undefined ? [] : [[id, v]]; })),
      effective: effectiveAnswers(answers, TODAY),
      filled: typicalFilled(answers, TODAY),
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

  it("the two choices of a pair untick each other (B74)", () => {
    const C22 = Q_BY_ID.C22;
    const tap = (...taps: string[]) => taps.reduce((p, o) => toggleOption(C22, p, o), [] as string[]);
    expect(tap("backward_help", "backward_alone")).toEqual(["backward_alone"]);
    expect(tap("backward_alone", "backward_help")).toEqual(["backward_help"]);
    expect(tap("backward_alone", "backward_alone")).toEqual([]); // tapping a ticked choice unticks it
    expect(tap("turns", "backward_help", "circle")).toEqual(["turns", "backward_help", "circle"]);
    expect(tap("backward_help", "none_yet")).toEqual(["none_yet"]);
    expect(tap("none_yet", "backward_help")).toEqual(["backward_help"]);
    expect(toggleOption(Q_BY_ID.C24, ["step_over_alone"], "step_over_help")).toEqual(["step_over_help"]);
    expect(toggleOption(Q_BY_ID.C24, ["grass"], "none_yet")).toEqual(["none_yet"]);
    expect(toggleOption(Q_BY_ID.J9, ["sit", "stand", "walk"], "hold")).toEqual(["sit", "stand", "walk"]); // past "Pick up to 3"
    expect(upgrade({ C22: ["backward_help", "backward_alone"] }).C22).toEqual(["backward_alone"]);
    expect(upgrade({ C22: ["backward_help", "turns"] }).C22).toEqual(["backward_help", "turns"]);
    expect(upgrade({ C24: ["step_over_help", "step_over_alone"] }).C24).toEqual(["step_over_alone"]);
  });

  it("the old center question maps to the two new ones (B75)", () => {
    expect(Q_BY_ID.I8).toBeUndefined(); // retired, its id never reused
    for (const id of ["I8_place", "I8_lang"]) expect(Q_BY_ID[id]).toMatchObject({ kind: "multi", required: false, step: "I", feeds: ["R"], exclusive: "any" });
    const ids = QUESTIONNAIRE.questions.map((q) => q.id);
    expect(ids[ids.indexOf("I8_place") + 1]).toBe("I8_lang");
    expect(upgrade({ I8: ["state", "russian_doctor"] })).toMatchObject({ I8_place: ["state"], I8_lang: ["ru"] });
    expect(upgrade({ I8: ["private", "uzbek_doctor"] })).toMatchObject({ I8_place: ["private"], I8_lang: ["uz"] });
    expect(upgrade({ I8: ["uzbek_doctor"] }).I8_place).toBeUndefined();
    expect(upgrade({ I8: ["state"], I8_place: ["online"] }).I8_place).toEqual(["online"]); // a new answer wins
  });

  it("every option of a grouped question is in exactly one group (B74)", () => {
    for (const q of QUESTIONNAIRE.questions.filter((x) => x.option_groups)) {
      expect(q.option_groups!.flatMap((g) => g.options).sort(), q.id).toEqual([...q.options!].sort());
      for (const g of q.option_groups!) if (g.text) for (const l of ["en", "uz", "ru"]) expect(g.text[l], `${q.id} ${l}`).toBeTruthy();
    }
    expect(Q_BY_ID.B11.options![0]).toBe("none");
  });

  describe("Quick check (B76)", () => {
    /** What a parent sees: the cards on screen, so no "own words" box and nothing behind "Add more details". */
    const card = (id: string) => Q_BY_ID[id].step !== "K" && !(id.endsWith("_note") && Q_BY_ID[id.slice(0, -5)]?.ladder); // section K is not in the wizard yet
    const count = (a: QAnswers) => visible(a, TODAY).filter((id) => card(id) && !Q_BY_ID[id].fold).length;
    /** The same child before the Quick check: every answer given, none of them to the Quick check. */
    const before = (a: QAnswers) => {
      const old = { ...effectiveAnswers(a, TODAY) };
      for (const id of QC_IDS) delete old[id];
      return visible({ ...old, J1: "10" }, TODAY).filter(card).length;
    };
    const sections = (a: QAnswers) => [...new Set(visible(a, TODAY).map((id) => Q_BY_ID[id].step))];
    const BABY = ["C1", "C2", "C3", "C4", "C14", "C15", "C17"];
    const MONTHS = ["DD2", "DD2_sit", "DD2_walk", "DD2_word"];

    it("persona counts (written in the report)", () => {
      expect(count(M)).toBeLessThanOrEqual(50); // the real number: "Optional questions folded" in TASKS.md section 3
      const w = visible(W, TODAY);
      for (const id of [...BABY, ...MONTHS]) expect(w, id).not.toContain(id);
      expect([before(M), count(M), before(W), count(W), before(S), count(S)]).toEqual([135, 50, 135, 49, 132, 120]);
    });

    it("a section's answer decides what it asks", () => {
      const inC = (a: QAnswers) => visible(a, TODAY).filter((id) => Q_BY_ID[id].step === "C" && !id.endsWith("_note"));
      const base = { A2: "2016-05-01", B1: ["dcd"] };
      expect(inC({ ...QC_ALL("none"), ...base })).toEqual(["C12"]); // what must always be asked stays
      expect(inC({ ...QC_ALL("some"), ...base })).toEqual(["C5", "C6", "C3", "C1", "C11", "C12"].filter((id) => visible({ ...base }, TODAY).includes(id)).sort(byOrder));
      expect(inC({ ...QC_ALL("a_lot"), ...base }).length).toBeGreaterThan(inC({ ...QC_ALL("some"), ...base }).length);
      expect(sections({ ...QC_ALL("none"), ...base })).not.toContain("D"); // nothing left: no banner, not counted
      expect(sections({ ...QC_ALL("none"), ...base })).toContain("C");
      for (const s of ["C", "D", "E", "F", "G", "H"]) expect(QUESTIONNAIRE.questions.filter((q) => q.step === s && q.core).length, s).toBeLessThanOrEqual(6);
    });

    it("every question a none can hide has a typical answer, in today's options", () => {
      for (const q of QUESTIONNAIRE.questions.filter((x) => "CDEFGH".includes(x.step) && x.step.length === 1 && x.audience === "parent" && !x.always)) {
        if (q.id.endsWith("_note") && Q_BY_ID[q.id.slice(0, -5)]?.ladder) continue;
        expect("typical" in q, q.id).toBe(true);
        for (const o of [q.typical ?? []].flat()) expect(q.options, q.id).toContain(o);
      }
    });

    it("typical answers fill only what is missing, and never a saved answer", () => {
      const a = { ...QC_ALL("none"), A2: "2016-03-01", B1: ["dcd"], C6: "one_hand", F6: "hard", E3: null };
      const e = effectiveAnswers(a, TODAY);
      expect([e.C6, e.F6, e.E3]).toEqual(["one_hand", "hard", null]); // the parent's, "Not sure" included
      expect([e.C5, e.F1, e.H1]).toEqual(["alone_over_1min", "yes", "self"]);
      expect(a).toEqual({ ...QC_ALL("none"), A2: "2016-03-01", B1: ["dcd"], C6: "one_hand", F6: "hard", E3: null }); // nothing saved over
      expect(typicalFilled(a, TODAY)).not.toContain("C6");
      expect(effectiveAnswers({ ...QC_ALL("some"), A2: "2016-03-01" }, TODAY).C5).toBeUndefined(); // "A little" fills nothing
    });

    it("a skill gained later stays empty below its age", () => {
      const at = (born: string) => effectiveAnswers({ ...QC_ALL("none"), A2: born, B1: ["other"] }, TODAY);
      const small = at("2024-06-01"); // 28 months
      for (const id of ["C8", "C9", "C20", "D13_buttons", "D13_zip", "H2", "H3", "G10"]) expect(small[id], id).toBeUndefined();
      expect(small.C6).toBe("alone_7m");
      const big = at("2012-06-01");
      for (const id of ["C8", "C9", "C20", "D13_buttons", "D13_zip", "H2", "H3", "G10"]) expect(big[id], id).toBeDefined();
    });

    it("cerebral palsy: no difficulty moving or with the hands still gets the short version", () => {
      const cp = { ...QC_ALL("none"), A2: "2016-03-01", B1: ["cp"], CP1_types: ["spastic"] };
      const v = visible(cp, TODAY);
      for (const id of ["C10", "C5", "C6", "D1", "D4"]) expect(v, id).toContain(id);
      expect(v).not.toContain("C18"); // not core
      expect(effectiveAnswers(cp, TODAY).C6).toBeUndefined(); // "A little" fills nothing
      expect(effectiveAnswers(cp, TODAY).F1).toBe("yes"); // the other sections stay "No difficulty"
    });

    it("the rules read the walking and sitting steps as before", () => {
      const walks = { ...QC_ALL("a_lot"), A2: "2016-03-01", B1: ["developmental_delay"] };
      for (const id of BABY) expect(visible({ ...walks, C6: "alone_few_m" }, TODAY), id).not.toContain(id);
      for (const id of BABY) expect(visible({ ...walks, C5: "alone_under_10s" }, TODAY), id).not.toContain(id);
      expect(visible({ ...walks, C6: "one_hand" }, TODAY)).toContain("C3");
      expect(effectiveAnswers({ ...walks, C6: "alone_7m" }, TODAY).C3).toBe("free_30min");
      const filled = effectiveAnswers({ ...walks, C6: "alone_few_m" }, TODAY);
      expect(filled.C4).toBe("walks");
      const f = visible({ ...walks, C6: "alone_few_m" }, TODAY); // not R6: walking questions stay
      for (const id of ["C7", "C8", "C21", "C22"]) expect(f, id).toContain(id);
      expect(visible({ ...walks, C3: "cant_sit" }, TODAY)).not.toContain("C7"); // R6
    });

    it("the date questions stop at 6 years", () => {
      const at = (born: string) => visible({ ...QC_ALL("a_lot"), A2: born, B1: ["developmental_delay"] }, TODAY);
      for (const id of MONTHS) expect(at("2020-11-01"), id).toContain(id); // 71 months
      for (const id of MONTHS) expect(at("2020-10-22"), id).not.toContain(id); // 72 months
    });

    it("an old child without Quick check answers sees everything, and nothing is filled", () => {
      const old = { A2: "2016-03-01", B1: ["developmental_delay"], B3_parts: ["none"], C6: "alone_7m" };
      expect(quickCheckOn(old)).toBe(false);
      expect(effectiveAnswers(old, TODAY)).toEqual(old);
      expect(typicalFilled(old, TODAY)).toEqual([]);
      const v = visible(old, TODAY);
      for (const id of [...MONTHS, "C3", "D4"]) expect(v, id).toContain(id);
      for (const id of QC_IDS) expect(v, id).not.toContain(id);
      expect(quickCheckDefaults(old)).toEqual(old);
    });

    it("moving starts on no difficulty when no body part is affected, or only the face and mouth", () => {
      expect(quickCheckDefaults({ B3_parts: ["none"] }).QC_move).toBe("none");
      expect(quickCheckDefaults({ B3_parts: ["face_mouth"] }).QC_move).toBe("none");
      expect(quickCheckDefaults({ B3_parts: ["face_mouth", "trunk"] }).QC_move).toBeUndefined();
      expect(quickCheckDefaults({}).QC_move).toBeUndefined();
      expect(quickCheckDefaults({ B3_parts: ["none"], QC_move: "a_lot" }).QC_move).toBe("a_lot"); // the parent's answer stays
    });

    it("the Quick check has no Not sure and comes right after section B", () => {
      const steps = QUESTIONNAIRE.steps;
      expect(steps[steps.indexOf("B") + 1]).toBe("QC");
      for (const id of QC_IDS) expect(offersNotSure(Q_BY_ID[id]), id).toBe(false);
      const ids = QUESTIONNAIRE.questions.map((q) => q.id);
      expect(ids.slice(ids.indexOf("B13") + 1, ids.indexOf("B13") + 7)).toEqual(QC_IDS);
      const inC = QUESTIONNAIRE.questions.filter((q) => q.step === "C").map((q) => q.id);
      expect(inC.slice(0, 5)).toEqual(["C5", "C5_note", "C5_minutes", "C6", "C6_note"]);
    });
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
