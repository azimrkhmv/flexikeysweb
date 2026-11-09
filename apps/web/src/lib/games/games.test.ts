import { describe, expect, it } from "vitest";
import { SKILL_GAMES } from "@/content/skillGames";
import { STORIES } from "@/content/stories";
import { SOUND_GROUPS } from "@/content/words";
import { VOCAB } from "@/content/vocab";
import type { Lang } from "@/lib/i18n";
import { GENERATORS, makeRounds, type Generator, type SkillKind } from "./index";
import { lookOf, PICTURES } from "./pools";
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
      });

  it("the same seed gives the same rounds, another day other rounds", () => {
    const g = SKILL_GAMES[0];
    const a = makeRounds("find_same", g.steps[5].settings as never, daySeed("c1", "2026-11-09", g.id), "en");
    expect(makeRounds("find_same", g.steps[5].settings as never, daySeed("c1", "2026-11-09", g.id), "en")).toEqual(a);
    expect(makeRounds("find_same", g.steps[5].settings as never, daySeed("c1", "2026-11-10", g.id), "en")).not.toEqual(a);
    expect(rngOf(1)()).toBe(rngOf(1)());
  });

  it("12 skill games, 12 steps each, every step with a can-do sentence in en, ru and uz", () => {
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
    for (const tier of [1, 2, 3, 4]) expect(STORIES.filter((s) => s.tier === tier)).toHaveLength(4);
    for (const s of STORIES) {
      expect(s.pages).toHaveLength(s.tier + 2);
      for (const q of s.questions) if ("answer" in q) for (const o of q.options) expect(VOCAB[o], `${s.id}: ${o}`).toBeDefined();
    }
  });
});
