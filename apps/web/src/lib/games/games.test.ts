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
    const g = SKILL_GAMES[0];
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
