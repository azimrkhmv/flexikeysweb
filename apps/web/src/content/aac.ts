import type { Lang } from "@/lib/i18n";
import type { AacCard, AacCustomCard, L10n } from "@/lib/types";

// AAC "My Voice" vocabulary (PRD §9.11). Speaks in the UI language.
export const AAC_CATEGORIES: { id: string; emoji: string; label: L10n }[] = [
  { id: "core", emoji: "⭐", label: { en: "Core", uz: "Asosiy", ru: "Главное" } },
  { id: "needs", emoji: "🥤", label: { en: "Needs", uz: "Ehtiyojlar", ru: "Нужды" } },
  { id: "feelings", emoji: "😊", label: { en: "Feelings", uz: "Hislar", ru: "Чувства" } },
  { id: "people", emoji: "👪", label: { en: "People", uz: "Odamlar", ru: "Люди" } },
  { id: "places", emoji: "🏠", label: { en: "Places", uz: "Joylar", ru: "Места" } },
  { id: "play", emoji: "🧸", label: { en: "Play", uz: "Oʻyin", ru: "Игра" } },
  { id: "daily", emoji: "🌞", label: { en: "Daily", uz: "Kundalik", ru: "Каждый день" } },
];

const c = (id: string, category: string, emoji: string, en: string, uz: string, ru: string, core = false): AacCard => ({
  id, category, emoji, label: { en, uz, ru }, core,
});

export const AAC_CARDS: AacCard[] = [
  c("i", "core", "🙋", "I", "Men", "Я", true),
  c("want", "core", "🤲", "want", "xohlayman", "хочу", true),
  c("more", "core", "➕", "more", "yana", "ещё", true),
  c("stop", "core", "✋", "stop", "toʻxta", "стоп", true),
  c("help", "core", "🆘", "help", "yordam", "помоги", true),
  c("yes", "core", "👍", "yes", "ha", "да", true),
  c("no", "core", "👎", "no", "yoʻq", "нет", true),
  c("go", "core", "➡️", "go", "boramiz", "идти", true),
  c("like", "core", "💛", "like", "yoqadi", "нравится", true),
  c("finished", "core", "✅", "finished", "tugadi", "всё", true),

  c("water", "needs", "💧", "water", "suv", "вода"),
  c("eat", "needs", "🍽️", "eat", "ovqat", "кушать"),
  c("toilet", "needs", "🚽", "toilet", "hojatxona", "туалет"),
  c("sleep", "needs", "😴", "sleep", "uxlash", "спать"),
  c("hug", "needs", "🤗", "hug", "quchoqlash", "обнять"),
  c("juice", "needs", "🧃", "juice", "sharbat", "сок"),

  c("happy", "feelings", "😊", "happy", "xursand", "радостно"),
  c("sad", "feelings", "😢", "sad", "xafa", "грустно"),
  c("tired", "feelings", "🥱", "tired", "charchadim", "устал"),
  c("hurt", "feelings", "🤕", "hurts", "ogʻriyapti", "больно"),
  c("scared", "feelings", "😟", "scared", "qoʻrqdim", "страшно"),
  c("calm", "feelings", "😌", "calm", "tinch", "спокойно"),

  c("mom", "people", "👩", "mom", "ona", "мама"),
  c("dad", "people", "👨", "dad", "ota", "папа"),
  c("teacher", "people", "🧑‍🏫", "teacher", "ustoz", "учитель"),
  c("friend", "people", "🧒", "friend", "doʻst", "друг"),
  c("grandma", "people", "👵", "grandma", "buvi", "бабушка"),

  c("home", "places", "🏠", "home", "uy", "домой"),
  c("outside", "places", "🌳", "outside", "tashqari", "на улицу"),
  c("school", "places", "🏫", "school", "maktab", "в школу"),
  c("park", "places", "🎠", "park", "bogʻ", "в парк"),

  c("ball", "play", "⚽", "ball", "koptok", "мяч"),
  c("music", "play", "🎵", "music", "musiqa", "музыка"),
  c("draw", "play", "🖍️", "draw", "rasm chizish", "рисовать"),
  c("book", "play", "📖", "book", "kitob", "книга"),
  c("blocks", "play", "🧱", "blocks", "kubiklar", "кубики"),

  c("wash", "daily", "🧼", "wash hands", "qoʻl yuvish", "мыть руки"),
  c("brush", "daily", "🦷", "brush teeth", "tish yuvish", "чистить зубы"),
  c("dress", "daily", "👕", "get dressed", "kiyinish", "одеваться"),
  c("bath", "daily", "🛁", "bath", "choʻmilish", "купаться"),
];

export const AAC_BY_ID: Record<string, AacCard> = Object.fromEntries(AAC_CARDS.map((x) => [x.id, x]));

/** Always on screen, in the same place, on every My Voice page: a child must never have to look for these. */
export const AAC_QUICK = ["yes", "no", "help", "stop"] as const;

/** Modified Fitzgerald Key word classes — card border colours that teach sentence building. */
export type WordClass = "person" | "action" | "describe" | "thing" | "social";
const WORD_CLASS: Record<string, WordClass> = {
  i: "person", mom: "person", dad: "person", teacher: "person", friend: "person", grandma: "person",
  want: "action", go: "action", like: "action", help: "action", eat: "action", sleep: "action", hug: "action",
  draw: "action", wash: "action", brush: "action", dress: "action", bath: "action",
  more: "describe", happy: "describe", sad: "describe", tired: "describe", hurt: "describe", scared: "describe", calm: "describe",
  yes: "social", no: "social", stop: "social", finished: "social",
};
/** Built-in cards by id; custom cards by category (people → person, everything else → thing). */
export const wordClass = (id: string, category: string): WordClass => WORD_CLASS[id] ?? (category === "people" ? "person" : "thing");

/** Custom (parent-made) cards are referenced as `custom:<id>` in the sentence strip and in AAC events. */
export const CUSTOM_PREFIX = "custom:";

/** Emoji + label for any card id the child can use — built-in or custom (with or without the prefix). */
export function aacCard(
  cardId: string,
  lang: Lang,
  custom: readonly Pick<AacCustomCard, "id" | "emoji" | "label" | "photo" | "audio">[],
): { emoji: string; label: string; photo?: string; audio?: string } | null {
  const builtIn = AAC_BY_ID[cardId];
  if (builtIn) return { emoji: builtIn.emoji, label: builtIn.label[lang] };
  const bare = cardId.startsWith(CUSTOM_PREFIX) ? cardId.slice(CUSTOM_PREFIX.length) : cardId;
  const c = custom.find((x) => x.id === bare);
  return c ? { emoji: c.emoji, label: c.label, photo: c.photo, audio: c.audio } : null;
}
