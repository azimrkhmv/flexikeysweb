import { VOCAB } from "@/content/vocab";
import { SOUND_GROUPS } from "@/content/words";
import type { Lang } from "@/lib/i18n";
import { isGlyph, looks } from "./glyph";

// The item pools the round generators draw from: the emoji pictures of the theme worlds (content/vocab.ts), by
// group, so a sort round knows which box each picture belongs in.

export const CATEGORIES = {
  fruits: ["apple", "banana", "pear", "grapes", "orange", "cherry", "strawberry", "watermelon", "lemon", "peach"],
  vegetables: ["carrot", "tomato", "cucumber", "potato", "onion", "corn", "pepper", "eggplant"],
  animals: ["cat", "dog", "cow", "horse", "sheep", "bird", "fish", "rabbit", "bear", "lion", "chicken", "frog"],
  toys: ["ball", "teddy", "kite", "blocks", "balloon", "drum", "yoyo", "puzzle"],
  transport: ["car", "bus", "train", "plane", "bike", "boat", "truck", "rocket", "tractor"],
  clothes: ["tshirt", "dress", "cap", "socks", "shoes", "coat", "gloves", "scarf"],
  nature: ["sun", "moon", "star", "tree", "flower", "rain", "cloud", "snow", "leaf"],
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];
/** The picture on a sort box (never one of the pictures sorted into it). */
export const CATEGORY_ICON: Record<Category, string> = { fruits: "🧺", vegetables: "🥗", animals: "🐾", toys: "🎁", transport: "🚦", clothes: "👚", nature: "🌍" };

/** Every picture of the pools: one emoji each, never two items with the same picture. */
export const PICTURES: string[] = CATEGORY_IDS.flatMap((c) => [...CATEGORIES[c]]);
export const categoryOf = (id: string) => CATEGORY_IDS.find((c) => (CATEGORIES[c] as readonly string[]).includes(id));

// ---- ids the skill games add to the vocab ids: `num:42` (a number), `w:<lang>:<word>` (a sound-alike word with a
// picture), `p:<n>` (page n of a story).
export const numId = (n: number) => `num:${n}`;
export const numOf = (id: string) => Number(id.slice(4));
export const wordId = (lang: Lang, word: string) => `w:${lang}:${word}`;
const WORD_EMOJI: Record<string, string> = Object.fromEntries(
  (Object.keys(SOUND_GROUPS) as Lang[]).flatMap((lang) => SOUND_GROUPS[lang].flat().map((x) => [wordId(lang, x.word), x.emoji])),
);
export const wordEmoji = (id: string) => WORD_EMOJI[id];
/** The word an item stands for in a language (what listen_pick says aloud). */
export function wordOf(id: string, lang: Lang): string | undefined {
  if (id.startsWith("w:")) return id.split(":")[2];
  return VOCAB[id]?.word[lang];
}

/**
 * What an item looks like on screen: two items with the same look can't be told apart, so a round must never offer
 * two of them as different answers.
 */
export function lookOf(id: string): string {
  if (isGlyph(id)) return looks(id);
  if (id.startsWith("w:")) return WORD_EMOJI[id] ?? id;
  if (id.startsWith("num:")) return id;
  const v = VOCAB[id];
  return v?.emoji ?? v?.color ?? v?.shape ?? v?.glyph ?? id;
}
