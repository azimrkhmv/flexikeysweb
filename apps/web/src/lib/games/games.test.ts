import { describe, expect, it } from "vitest";
import { SKILL_GAMES } from "@/content/skillGames";
import { STORIES } from "@/content/stories";
import { SAY_COLORS, SAY_SHAPES, SAY_TEXTS, sayKnown, showMe, showShape } from "@/content/sayTexts";
import { DROPS, RHYMES, SOUND_GROUPS } from "@/content/words";
import { VOCAB } from "@/content/vocab";
import { reducedKeys } from "@/features/activities/keyboard";
import type { Lang } from "@/lib/i18n";
import { LAYOUTS } from "@/lib/keys";
import { GENERATORS, makeRounds, type Generator, type SkillKind } from "./index";
import { afterMoves, cloudPlaces, cloudRows, GROW_CELLS } from "./cloudy";
import { holds, lineText } from "./math";
import { lookOf, PIC_WORDS, PICTURES } from "./pools";
import { daySeed, rngOf } from "./rng";

// Games spec 8 Nov 2026, §1: every generator, with a fixed seed and 200 rounds, gives rounds with exactly one right
// answer, and no round comes twice in one session.
const LANGS: Lang[] = ["en", "ru", "uz"];

describe("skill game rounds", () => {
  for (const game of SKILL_GAMES)
    for (const s of game.steps)
      it(`${game.id} ${s.tier}.${s.step}: one right answer, no round twice in a session`, () => {
        const gen = GENERATORS[game.kind as SkillKind] as unknown as Generator<unknown, unknown>;
        for (const lang of LANGS) {
          const sessions = Math.ceil(200 / gen.rounds);
          for (let k = 0; k < sessions; k++) {
            const rounds = makeRounds(game.kind as SkillKind, s.settings as never, daySeed("test-child", `day${k}`, game.id), lang);
            expect(rounds.length, `${lang} session ${k}`).toBe(gen.rounds);
            expect(new Set(rounds.map((r) => gen.key(r))).size).toBe(rounds.length);
            for (const r of rounds) expect(gen.answers(r), JSON.stringify(r)).toEqual(gen.answers(r).map(() => 1));
          }
        }
      }, 30_000); // 600 rounds each; the 9×9 mazes need more than the default 5 s on a busy machine

  it("the same seed gives the same rounds, another day other rounds", () => {
    const g = SKILL_GAMES.find((x) => x.kind === "find_same")!;
    const a = makeRounds("find_same", g.steps[5].settings as never, daySeed("c1", "2026-11-09", g.id), "en");
    expect(makeRounds("find_same", g.steps[5].settings as never, daySeed("c1", "2026-11-09", g.id), "en")).toEqual(a);
    expect(makeRounds("find_same", g.steps[5].settings as never, daySeed("c1", "2026-11-10", g.id), "en")).not.toEqual(a);
    expect(rngOf(1)()).toBe(rngOf(1)());
  });

  it("every skill game has 12 steps, every step with a can-do sentence in en, ru and uz", () => {
    expect(SKILL_GAMES.map((g) => g.kind).sort()).toEqual(Object.keys(GENERATORS).sort());
    for (const g of SKILL_GAMES) {
      expect(g.steps.map((s) => `${s.tier}.${s.step}`)).toEqual(["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3", "4.1", "4.2", "4.3"]);
      for (const s of g.steps) for (const l of LANGS) expect(s.can_do?.[l], `${g.id} ${s.tier}.${s.step} ${l}`).toMatch(/\S/);
      // Each step says something different, so the parent panel can show a change.
      expect(new Set(g.steps.map((s) => s.can_do?.en)).size, g.id).toBe(12);
    }
  });

  it("pictures and words: one picture each, stories use known pictures", () => {
    expect(new Set(PICTURES.map(lookOf)).size).toBe(PICTURES.length);
    for (const lang of LANGS) {
      for (const group of SOUND_GROUPS[lang]) expect(new Set(group.map((x) => x.emoji)).size, group.map((x) => x.word).join()).toBe(group.length);
      expect(new Set(SOUND_GROUPS[lang].flat().map((x) => x.word)).size).toBe(SOUND_GROUPS[lang].flat().length);
    }
    for (const lang of LANGS) {
      // One picture per word across every list of the language.
      const seen = new Map<string, string>();
      for (const x of PIC_WORDS(lang)) {
        expect(seen.get(x.word) ?? x.emoji, `${lang} ${x.word}`).toBe(x.emoji);
        seen.set(x.word, x.emoji);
      }
    }
    for (const tier of [1, 2, 3, 4]) expect(STORIES.filter((s) => s.tier === tier)).toHaveLength(4);
    for (const s of STORIES) {
      expect(s.pages).toHaveLength(s.tier + 2);
      for (const q of s.questions) if ("answer" in q) for (const o of q.options) expect(VOCAB[o], `${s.id}: ${o}`).toBeDefined();
    }
  });

  // §6.6: each language has its own lists, at least 30 rhyme pairs and 20 texts per tier.
  it("language lists: 30+ rhyme pairs, sounds taken away, 20 texts per tier in each language", () => {
    for (const lang of LANGS) {
      const families = RHYMES[lang];
      expect(families.reduce((n, f) => n + (f.length * (f.length - 1)) / 2, 0), lang).toBeGreaterThanOrEqual(30);
      const words = families.flat().map((x) => x.word);
      expect(new Set(words).size, lang).toBe(words.length);
      for (const f of families) expect(f.length).toBeGreaterThanOrEqual(2);
      for (const x of DROPS[lang]) expect(x.from.word.replace(x.sound, ""), `${lang} ${x.from.word}`).toBe(x.to.word);
      expect(DROPS[lang].length, lang).toBeGreaterThanOrEqual(5);
      // Seed and Sprout say generated sentences: far more than 20 of them.
      expect(new Set(PICTURES.map((p) => showMe(VOCAB[p].word[lang], lang))).size).toBeGreaterThanOrEqual(20);
      expect(new Set(SAY_COLORS.flatMap((c) => (Object.keys(SAY_SHAPES) as (keyof typeof SAY_SHAPES)[]).map((s) => showShape(s, c, null, lang)))).size).toBeGreaterThanOrEqual(20);
    }
    for (const tier of [3, 4] as const) {
      const texts = SAY_TEXTS.filter((t) => t.tier === tier);
      expect(texts).toHaveLength(20);
      for (const t of texts) {
        expect(sayKnown(t), t.id).toBe(true);
        expect(t.options[0], t.id).toBe(t.answer);
        expect(new Set(t.options).size, t.id).toBe(4);
        for (const lang of LANGS) {
          const sentences = t.text[lang].split(/(?<=[.!?])\s+/).length;
          expect(sentences, `${t.id} ${lang}`).toBeGreaterThanOrEqual(tier === 3 ? 2 : 3);
          expect(sentences, `${t.id} ${lang}`).toBeLessThanOrEqual(tier === 3 ? 2 : 4);
          expect(t.question[lang], `${t.id} ${lang}`).toMatch(/\?$/);
        }
      }
    }
    expect(new Set(SAY_TEXTS.map((t) => t.id)).size).toBe(SAY_TEXTS.length);
  });

  it("word builder: the reduced keyboard always ends, with the word's letters and the extras asked for", () => {
    for (const lang of LANGS) {
      const all = LAYOUTS[lang].flat();
      for (let n = 1; n <= 8; n++)
        for (let extra = 0; extra <= 6; extra++) {
          const needed = all.slice(0, n);
          const keys = reducedKeys(lang, needed, n + extra);
          expect(keys).toHaveLength(n + extra);
          expect(needed.every((k) => keys.includes(k))).toBe(true);
        }
    }
  });

  it("missing number: the sum checker", () => {
    expect(holds([12, "×", "?", "−", 7, "=", 29], 3)).toBe(true);
    expect(holds([12, "×", "?", "−", 7, "=", 29], 4)).toBe(false);
    expect(holds([5, "+", 4, "−", "?", "=", 6], 3)).toBe(true);
    expect(holds([24, "÷", "?", "=", 6], 4)).toBe(true);
    expect(lineText(7, 4)).toBe("1¾");
    expect(lineText(2, 4)).toBe("½");
    expect(lineText(0, 4)).toBe("0");
    expect(lineText(8, 4)).toBe("2");
  });
});

// B104, Warm Hills spec §6.1: Find Cloudy's tiers do what the table says.
describe("find_cloudy", () => {
  const g = SKILL_GAMES.find((x) => x.kind === "find_cloudy")!;
  const roundsOf = (k: number, day: number) => makeRounds("find_cloudy", g.steps[k].settings as never, daySeed("c", `d${day}`, g.id), "en");
  it("Seed: Cloudy stays out, Sprout: he peeks, Tree and Summit: the clouds swap and he is followed", () => {
    expect(g.steps.map((s) => (s.settings as { clouds: number }).clouds)).toEqual([3, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8]);
    for (let k = 0; k < 12; k++)
      for (let day = 0; day < 30; day++)
        for (const r of roundsOf(k, day)) {
          const want = k < 3 ? "stay" : k < 6 ? "peek" : "once";
          expect(r.peek).toBe(want);
          const swaps = r.moves.filter((m) => "swap" in m);
          if (want !== "once") expect(r.moves).toEqual([]);
          else {
            expect(swaps.length).toBe((g.steps[k].settings as { swaps: number }).swaps);
            // At least one swap moves Cloudy's own cloud, so watching it is needed.
            let cloudy = r.hide;
            let own = 0;
            for (const m of r.moves) {
              if ("jump" in m) cloudy = m.jump;
              else if (m.swap.includes(cloudy)) own++;
            }
            expect(own).toBeGreaterThan(0);
          }
          // The jump only at Summit 3, once, to another cloud.
          expect(r.moves.filter((m) => "jump" in m).length).toBe(k === 11 ? 1 : 0);
          expect(afterMoves(r).cloudy).toBeGreaterThanOrEqual(0);
        }
  });
  it("the clouds never cover each other, in a wide or a tall sky", () => {
    for (let n = 3; n <= 8; n++)
      for (const tall of [false, true]) {
        const p = cloudPlaces(n, tall);
        expect(p).toHaveLength(n);
        const cols = Math.max(...cloudRows(n, tall));
        const [w, h] = tall ? [330, 440] : [640, 480];
        const cw = (w * 0.8) / cols; // as the player sizes them
        for (let a = 0; a < n; a++)
          for (let b = a + 1; b < n; b++) {
            const dx = Math.abs(p[a][0] - p[b][0]) * (w / 100);
            const dy = Math.abs(p[a][1] - p[b][1]) * (h / 100);
            expect(dx >= cw * 0.95 || dy >= cw * 0.6, `${n} ${tall} ${a}-${b}`).toBe(true);
          }
        for (const [x] of p) expect(x - ((cw / w) * 100) / 2).toBeGreaterThanOrEqual(0);
      }
  });
});

// B105, Warm Hills spec §6.2: Grow Cloudy's tiers, and Summit only with Math tier 2 open.
describe("grow_cloudy", () => {
  const g = SKILL_GAMES.find((x) => x.kind === "grow_cloudy")!;
  it("four growth stages a session; Seed any drop, Sprout drops and leaves, Tree sizes, Summit numbers 1…n", () => {
    const rules = g.steps.map((s) => (s.settings as { rule: string }).rule);
    expect(rules).toEqual(["any", "any", "any", "drops", "drops", "drops", "size", "size", "size", "order", "order", "order"]);
    for (let k = 0; k < 12; k++)
      for (let day = 0; day < 30; day++) {
        const rounds = makeRounds("grow_cloudy", g.steps[k].settings as never, daySeed("c", `d${day}`, g.id), "en");
        expect(rounds).toHaveLength(4);
        for (const r of rounds) {
          const st = g.steps[k].settings as { drops: number; leaves?: number };
          expect(r.drops).toHaveLength(st.drops);
          expect(r.leaves).toHaveLength(st.leaves ?? 0);
          expect(r.drops.length + r.leaves.length).toBeLessThanOrEqual(GROW_CELLS);
          const ranks = r.drops.map((d) => d.rank).sort((a, b) => a - b);
          if (r.rule === "size" || r.rule === "order") expect(ranks).toEqual(ranks.map((_, i) => i + 1));
          else expect(new Set(ranks)).toEqual(new Set([0]));
        }
      }
    expect(g.steps[0].settings).toMatchObject({ drops: 3, rule: "any" }); // the demo's Seed 1
    expect(g.steps[11].settings).toMatchObject({ drops: 5, rule: "order", show: 3 }); // and Summit 3
  });
  it("the Summit steps need Math tier 2 open (the numbers are read); no other step needs anything", () => {
    for (const s of g.steps) expect(s.needs).toEqual(s.tier === 4 ? { area: "numeracy", tier: 2 } : undefined);
  });
});
