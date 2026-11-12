import type { Lang } from "@/lib/i18n";
import * as attention from "./attention";
import * as existing from "./existing";
import * as flexibility from "./flexibility";
import * as language from "./language";
import * as math from "./math";
import * as memory from "./memory";
import * as reasoning from "./reasoning";
import { rngOf, type Rng } from "./rng";

// Rounds are generated, not hand-written (games spec 8 Nov 2026, §1): a step gives the settings, `makeRounds` builds
// one session's rounds from them and a seed (child id + date + activity id, see `daySeed`).

export interface Generator<S, R> {
  /** Rounds in one session. */
  rounds: number;
  make(settings: S, rng: Rng, lang: Lang): R;
  /** Two rounds with the same key are the same round. */
  key(round: R): string;
  /** For each question of the round, how many options are right, worked out from the round alone (tests: all 1). */
  answers(round: R): number[];
}

export const GENERATORS = {
  find_same: existing.findSame,
  scene: existing.scene,
  story: existing.story,
  sequence: existing.sequence,
  missing: existing.missing,
  light_path: existing.lightPath,
  sort: existing.sort,
  maze: existing.maze,
  puzzle: existing.puzzle,
  listen_pick: existing.listenPick,
  type: existing.type,
  count: existing.count,
  // §6.1 Attention
  odd_one_out: attention.oddOneOut,
  track_fish: attention.trackFish,
  which_way: attention.whichWay,
  // §6.2 Memory
  card_pairs: memory.cardPairs,
  shopping_list: memory.shoppingList,
  n_back: memory.nBack,
  pairs_recall: memory.pairsRecall,
  // §6.3 Flexibility
  switch_sort: flexibility.switchSort,
  opposite: flexibility.opposite,
  secret_rule: flexibility.secretRule,
  // §6.4 Reasoning
  next_pattern: reasoning.nextPattern,
  balance: reasoning.balance,
  pipes: reasoning.pipes,
  logic_houses: reasoning.logicHouses,
  shadow_match: reasoning.shadowMatch,
  // §6.5 Math
  more_less: math.moreLess,
  number_line: math.numberLine,
  bazaar: math.bazaar,
  missing_number: math.missingNumber,
  // §6.6 Language
  rhyme: language.rhyme,
  word_builder: language.wordBuilder,
  do_what_i_say: language.doWhatISay,
};
export type SkillKind = keyof typeof GENERATORS;
export type SettingsOf<K extends SkillKind> = Parameters<(typeof GENERATORS)[K]["make"]>[0];
export type RoundOf<K extends SkillKind> = ReturnType<(typeof GENERATORS)[K]["make"]>;

/** One session's rounds: never the same round twice (a generator that runs out of new rounds stops early). */
export function makeRounds<K extends SkillKind>(kind: K, settings: SettingsOf<K>, seed: string | number, lang: Lang, count?: number): RoundOf<K>[] {
  const gen = GENERATORS[kind] as unknown as Generator<SettingsOf<K>, RoundOf<K>>;
  const rng = rngOf(seed);
  const out: RoundOf<K>[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < (count ?? gen.rounds) && tries < 50 * (count ?? gen.rounds); tries++) {
    const r = gen.make(settings, rng, lang);
    const k = gen.key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
