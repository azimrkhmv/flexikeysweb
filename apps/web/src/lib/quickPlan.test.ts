import { describe, expect, it } from "vitest";
import { exerciseLibrary } from "@/content/exercises";
import { QUICK_CHILDREN as CHILDREN, quickOf } from "@/content/personas";
import { Q_BY_ID, quickVisible, visible, type QAnswer, type QAnswers } from "@/content/questionnaire";
import { pView } from "@/content/questionnaireBridge";
import { buildRoadmap, exclusionReason, planFacts, type PlanInput } from "./roadmap";

// B103, spec 4.2: the plan from the quick start's answers holds no exercise that a fuller answer could forbid. For
// each sample child: the answers a quick start gives, the plan from them, and then every single answer to every
// question the quick start did not ask (each option, "Not sure", a recent and an old date). No such answer may make
// one of the plan's exercises forbidden: a restriction, a body area to leave out (surgery, pain, a broken bone) or a
// hold on all exercises. A different movement level, age band or tool is not a ban, only a closer fit, and the full
// questionnaire brings it. Games have no safety rule of their own (lib/roadmap.ts), so no answer forbids one.

const TODAY = "2026-10-22";
const LIB = exerciseLibrary("seed", "2026-10-01T00:00:00Z");
const FORBIDDEN = ["restriction", "surgery", "no_health_consent"];
const TOOLS = LIB.flatMap((v) => (v.tool ? [v.tool] : []));

const input = (answers: QAnswers): PlanInput => ({
  childId: "c1", round: 1, birthDate: String(answers.A2), startDate: TODAY, lang: "uz", answers: pView(answers, TODAY), healthConsent: true,
});

/** Each answer a parent could give to one question of the full questionnaire that the quick start left out. */
function answersTo(id: string): QAnswer[] {
  const q = Q_BY_ID[id];
  const out: QAnswer[] = [null];
  if (q.kind === "single") out.push(...(q.options ?? []));
  if (q.kind === "multi") out.push(...(q.options ?? []).map((o) => [o]));
  if (q.kind === "date") out.push("2026-10-01", "2020-01-01");
  return out;
}

/** Fuller answers: one more answer to a question the full questionnaire asks this child, and with it one answer to
 * a follow-up that answer opens (a date of surgery, which muscles...). */
function completions(quick: QAnswers): QAnswers[] {
  const open = (a: QAnswers) => visible(a, TODAY).filter((id) => a[id] === undefined);
  const base = open(quick);
  const out: QAnswers[] = [];
  for (const id of base)
    for (const v of answersTo(id)) {
      const one = { ...quick, [id]: v };
      out.push(one);
      for (const f of open(one).filter((x) => !base.includes(x))) for (const w of answersTo(f)) out.push({ ...one, [f]: w });
    }
  return out;
}


describe("quick start plan (B103)", () => {
  for (const [name, full] of CHILDREN)
    it(`${name}: no fuller answer forbids an exercise of the quick plan`, () => {
      const quick = quickOf(full);
      expect(Object.keys(quick).length, name).toBeLessThanOrEqual(23);
      for (const id of quickVisible(quick, TODAY)) expect(visible(quick, TODAY)).toContain(id);
      const plan = buildRoadmap(input(quick), LIB);
      const used = [...new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.videoId)))];
      expect(plan.exercisesAllowed, name).toBe(true);
      expect(used.length, `${name}: the quick plan has exercises`).toBeGreaterThan(0);
      const tried = completions(quick);
      expect(tried.length).toBeGreaterThan(200);
      for (const fuller of tried) {
        const f = planFacts(input(fuller));
        const changed = Object.entries(fuller).filter(([k]) => quick[k] === undefined);
        for (const ex of used) {
          const why = exclusionReason(LIB.find((v) => v.id === ex)!, f, "uz", TOOLS);
          expect(FORBIDDEN.includes(why ?? ""), `${name}: ${JSON.stringify(changed)} forbids ${ex} (${why})`).toBe(false);
        }
      }
    });

  it("an area marked \"A little\" or \"A lot\" is not filled with typical answers", () => {
    const quick = quickOf(CHILDREN[4][1]);
    const p = pView(quick, TODAY);
    // Hands ("A little"): the hand questions are not asked, so their levels stay unknown and the plan starts at level 1.
    expect(p.P23).toBeUndefined();
    expect(p.P24).toBeUndefined();
    // Eating and drinking ("A little" for the body): no answer means the mouth exercises stay out.
    expect(p.P17).toBeUndefined();
    expect(planFacts(input(quick)).restrictions.has("mouth_face")).toBe(true);
    // "No difficulty" is filled in: with the hands marked "No difficulty" the child picks up small things and taps
    // (not for CP, where "No difficulty" with the hands counts as "A little", B76).
    const fine = pView(quickOf({ ...CHILDREN[3][1], QC_hands: "none" }), TODAY);
    expect([fine.P23, fine.P26]).toEqual([2, 2]);
  });

  it("no height and weight needed (spec 4.1)", () => {
    const quick = quickOf(CHILDREN[0][1]);
    expect(quick.A4).toBeUndefined();
    expect(quick.A4_kg).toBeUndefined();
    expect(buildRoadmap(input(quick), LIB).days).toHaveLength(28);
  });
});
