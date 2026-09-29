import type { AacCard, L10n } from "@/lib/types";

// AAC "My Voice" vocabulary (PRD §9.11). Speaks in the UI language.
export const AAC_CATEGORIES: { id: string; emoji: string; label: L10n }[] = [
  { id: "core", emoji: "⭐", label: { en: "Core", uz: "Asosiy", ru: "Главное" } },
  { id: "needs", emoji: "🥤", label: { en: "Needs", uz: "Ehtiyojlar", ru: "Нужды" } },
  { id: "feelings", emoji: "😊", label: { en: "Feelings", uz: "Hislar", ru: "Чувства" } },
  { id: "people", emoji: "👪", label: { en: "People", uz: "Odamlar", ru: "Люди" } },
  { id: "places", emoji: "🏠", label: { en: "Places", uz: "Joylar", ru: "Места" } },
  { id: "play", emoji: "🧸", label: { en: "Play", uz: "Oʻyin", ru: "Игра" } },
  { id: "daily", emoji: "🪥", label: { en: "Daily", uz: "Kundalik", ru: "Каждый день" } },
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
  c("brush", "daily", "🪥", "brush teeth", "tish yuvish", "чистить зубы"),
  c("dress", "daily", "👕", "get dressed", "kiyinish", "одеваться"),
  c("bath", "daily", "🛁", "bath", "choʻmilish", "купаться"),
];

export const AAC_BY_ID: Record<string, AacCard> = Object.fromEntries(AAC_CARDS.map((x) => [x.id, x]));
