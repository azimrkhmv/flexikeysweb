import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planFacts } from "@/lib/roadmap";
import type { QAnswers } from "./questionnaire";
import { pView } from "./questionnaireBridge";
import { replaces, therapistInput } from "./therapist";

// IQ4: the website reads the CEO's questionnaire as the server does (apps/api/app/modules/intake/bridge.py).
// bridge_cases.json (here and a copy in apps/api/tests) makes the server prove the same. Regenerate with
// UPDATE_BACKEND=1 npm test.
const TODAY = "2026-10-22";
const CASES: { name: string; answers: QAnswers }[] = [
  { name: "no answers yet", answers: {} },
  {
    name: "one-sided CP, walks alone",
    answers: {
      A1: "Ali", A2: "2019-05-01", A3: "boy", B1: ["cp"], CP1: "spastic", CP2: "one_side", C10: "i", C3: "free_30min", B6: "no",
      B8: "no", CP3: "no", E10: "never", F1: "gesture", F2: "yes", G1: ["sentences"], D4: "thumb_finger", D12: "with_help",
      D7: "big_only", F6: "normal", F4: "5_15", H1: "some_help", H2: "helps", J9: ["walk", "hold", "tablet", "school"], J1: "45",
      H5: "midday", F9: ["music", "cars", "dolls"], E7: "no", E13: "no", B7: [],
    },
  },
  { name: "no GMFCS picture, walks with one hand", answers: { B1: ["dcd"], C6: "one_hand", C3: "free_few_min", G1: ["single_words"] } },
  { name: "delay, cannot sit or step", answers: { B1: ["developmental_delay"], C6: "doesnt_step", C3: "cant_sit", DD4: "yes" } },
  { name: "recent hip surgery", answers: { B1: ["cp"], B8: "yes", B8_type: ["hip", "spine"], B8_date: "2026-08-01", CP3: "no" } },
  { name: "surgery over a year ago", answers: { B1: ["cp"], B8: "yes", B8_type: ["hip"], B8_date: "2025-01-10", CP3: "no" } },
  { name: "Botox, date not sure", answers: { B1: ["cp"], B8: "no", CP3: "yes", CP3_muscles: ["left_leg", "right_hand"] } },
  { name: "Botox, no muscles marked", answers: { B1: ["cp"], B8: "no", CP3: "yes", CP3_date: "2026-09-01" } },
  { name: "lost a skill, seizures now", answers: { B1: ["cp"], C12: "yes", B6: "still" } },
  { name: "heart, shunt", answers: { B1: ["cp"], B7: ["heart", "shunt"], E7: "no", E13: "no" } },
  { name: "Down syndrome, neck not checked", answers: { B1: ["down_syndrome"], DS1: "not_checked", DS2: "yes" } },
  { name: "Down syndrome, neck checked fine", answers: { B1: ["down_syndrome"], DS1: "normal", DS2: "no" } },
  { name: "autism only", answers: { B1: ["autism"], G1: ["sounds_gestures"] } },
  { name: "pain often, nowhere marked", answers: { B1: ["cp"], E3: "often" } },
  { name: "pain sometimes, weak bones", answers: { B1: ["cp"], E3: "sometimes", E4: ["back", "left_foot"], E7: "yes", E7_where: ["shoulders"] } },
  { name: "implant", answers: { B1: ["other"], E13: "yes", E7: "no", DD4: "no" } },
  { name: "spoon not yet, cup with help", answers: { B1: ["cp"], D12_spoon: "no", D12_cup: "with_help", D11: "fingers" } },
  { name: "cup only", answers: { B1: ["cp"], D12_cup: "with_help", D11: "fingers" } },
];

const BACKEND = new URL("./backend/", import.meta.url);
const API_COPY = new URL("../../../api/tests/bridge_cases.json", import.meta.url);

describe("questionnaire bridge (IQ4)", () => {
  it("reads each sample child as the server does (shared with the server)", () => {
    const cases = CASES.map(({ name, answers }) => ({ name, today: TODAY, answers, p: pView(answers, TODAY) }));
    const json = `${JSON.stringify(cases, null, 1)}\n`;
    if (process.env.UPDATE_BACKEND) {
      writeFileSync(new URL("bridge_cases.json", BACKEND), json);
      writeFileSync(API_COPY, json);
    }
    expect(readFileSync(new URL("bridge_cases.json", BACKEND), "utf8")).toBe(json);
    expect(readFileSync(API_COPY, "utf8")).toBe(json);
  });

  it("a red flag holds every exercise and its restrictions reach the plan", () => {
    const facts = (name: string) =>
      planFacts({
        childId: "c", round: 1, birthDate: "2019-05-01", startDate: TODAY, lang: "en", healthConsent: true,
        answers: pView(CASES.find((c) => c.name === name)!.answers, TODAY),
      });
    expect(facts("one-sided CP, walks alone").exercisesAllowed).toBe(true);
    expect(facts("lost a skill, seizures now").exercisesAllowed).toBe(false);
    expect(facts("implant").restrictions).toContain("prone");
    expect([...facts("recent hip surgery").surgery].sort()).toEqual(["legs", "trunk"]);
  });

  it("no plan waits for a therapist (A4.8)", () => {
    const facts = (name: string) =>
      planFacts({
        childId: "c", round: 1, birthDate: "2019-05-01", startDate: TODAY, lang: "en", healthConsent: true,
        answers: pView(CASES.find((c) => c.name === name)!.answers, TODAY),
      });
    const down = facts("Down syndrome, neck checked fine");
    expect(down.exercisesAllowed).toBe(true);
    const downNeck = planFacts({
      childId: "c", round: 1, birthDate: "2019-05-01", startDate: TODAY, lang: "en", healthConsent: true,
      answers: pView({ B1: ["down_syndrome"], DS1: "not_checked" }, TODAY),
    });
    expect(downNeck.exercisesAllowed).toBe(true);
    expect([...downNeck.restrictions]).toEqual(expect.arrayContaining(["neck_flexion", "prone"]));
    const pain = facts("pain often, nowhere marked");
    expect(pain.exercisesAllowed).toBe(true);
    expect(pain.restrictions).toContain("high_intensity");
    expect(facts("autism only").exercisesAllowed).toBe(false); // games and My Voice (founders, 22 Oct)
    expect(facts("Down syndrome, neck not checked").exercisesAllowed).toBe(false); // the heart answer: see a doctor
  });

  it("a therapist's restrictions (T6, the questionnaire's L9) end the hold and are the ones used (IQ6)", () => {
    const t6 = { T6: { items: ["high_intensity"], text: "" } };
    const answers = { ...pView(CASES.find((c) => c.name === "implant")!.answers, TODAY), _hold: ["lost_skill"], ...replaces(t6, true) };
    const f = planFacts({ childId: "c", round: 1, birthDate: "2019-05-01", startDate: TODAY, lang: "en", healthConsent: true, answers, therapist: therapistInput([t6], true) });
    expect(f.exercisesAllowed).toBe(true);
    expect(f.restrictions).toContain("high_intensity");
    expect(f.restrictions).not.toContain("prone"); // the implant's red flag: the therapist decided
  });
});
