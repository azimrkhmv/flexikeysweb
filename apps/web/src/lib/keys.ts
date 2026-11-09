import type { Lang } from "./i18n";

// The letters of the on-screen keyboard (PRD §9.4), here so the round generators (lib/games) can use them too.

export const LAYOUTS: Record<Lang, string[][]> = {
  en: ["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((r) => [...r]),
  uz: [[..."qwertyuiop"], [..."asdfghjkl"], [..."zxcvbnm", "oʻ", "gʻ"]],
  ru: ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбюё"].map((r) => [...r]),
};

/** Splits a word into keyboard tokens. Uzbek "oʻ"/"gʻ" are single keys; apostrophe variants are normalized. */
export function tokenize(word: string, lang: Lang): string[] {
  const w = word.toLowerCase().normalize("NFC");
  if (lang !== "uz") return [...w];
  return w.replace(/([og])['‘’ʼ`]/g, "$1ʻ").match(/[og]ʻ|./gu) ?? [];
}
