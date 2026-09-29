import type { Level } from "@/lib/types";

// Content bundle (PRD §9.6). In production this JSON comes from /curriculum + /content/manifest;
// components must never hardcode child-facing words (FR-CUR-2) — they read them from here.

export const LEVELS: Level[] = [
  {
    id: "letters", n: 1, emoji: "🔤", color: "sky",
    title: { en: "Letters", uz: "Harflar", ru: "Буквы" },
    activities: [
      { id: "letters-type", kind: "type", mode: "letter", words: { en: ["a", "m", "s", "t", "o", "b"], uz: ["a", "o", "m", "s", "t", "b"], ru: ["а", "о", "м", "с", "т", "б"] } },
      { id: "letters-path", kind: "path", shape: "wave" },
      { id: "letters-light", kind: "light_path", length: 3 },
    ],
  },
  {
    id: "numbers", n: 2, emoji: "🔢", color: "sun",
    title: { en: "Numbers", uz: "Raqamlar", ru: "Цифры" },
    activities: [
      { id: "numbers-count", kind: "count", items: ["apple", "star", "ball", "fish"], max: 5 },
      { id: "numbers-listen", kind: "listen_pick", items: ["n_1", "n_2", "n_3", "n_4", "n_5"] },
      { id: "numbers-seq", kind: "sequence", items: ["n_1", "n_2", "n_3", "n_4"], length: 3 },
    ],
  },
  {
    id: "shapes", n: 3, emoji: "🔷", color: "lavender",
    title: { en: "Shapes", uz: "Shakllar", ru: "Фигуры" },
    activities: [
      { id: "shapes-same", kind: "find_same", items: ["s_circle", "s_square", "s_triangle", "s_star", "s_heart"] },
      { id: "shapes-listen", kind: "listen_pick", items: ["s_circle", "s_square", "s_triangle", "s_star", "s_heart", "s_rectangle"] },
      { id: "shapes-path", kind: "path", shape: "loop" },
    ],
  },
  {
    id: "colors", n: 4, emoji: "🎨", color: "peach",
    title: { en: "Colors", uz: "Ranglar", ru: "Цвета" },
    activities: [
      { id: "colors-seq", kind: "sequence", items: ["c_yellow", "c_blue", "c_green", "c_purple"], length: 4 },
      { id: "colors-listen", kind: "listen_pick", items: ["c_red", "c_blue", "c_green", "c_yellow", "c_purple", "c_pink"] },
      { id: "colors-same", kind: "find_same", items: ["c_orange", "c_blue", "c_green", "c_yellow", "c_pink"] },
    ],
  },
  {
    id: "family", n: 5, emoji: "👨‍👩‍👧", color: "teal",
    title: { en: "Family", uz: "Oila", ru: "Семья" },
    activities: [
      { id: "family-listen", kind: "listen_pick", items: ["mother", "father", "baby", "grandma", "grandpa", "sister", "brother"] },
      { id: "family-missing", kind: "missing", items: ["mother", "father", "baby", "grandma", "grandpa"] },
      { id: "family-type", kind: "type", mode: "word", words: { en: ["mom", "dad"], uz: ["ona", "ota"], ru: ["мама", "папа"] } },
    ],
  },
  {
    id: "animals", n: 6, emoji: "🐾", color: "leaf",
    title: { en: "Animals", uz: "Hayvonlar", ru: "Животные" },
    activities: [
      { id: "animals-listen", kind: "listen_pick", items: ["cat", "dog", "cow", "horse", "sheep", "bird", "rabbit", "bear"] },
      { id: "animals-same", kind: "find_same", items: ["cat", "dog", "lion", "frog", "chicken", "fish"] },
      { id: "animals-puzzle", kind: "puzzle", item: "dog", grid: 2 },
      { id: "animals-type", kind: "type", mode: "word", words: { en: ["cat", "dog"], uz: ["it", "ot"], ru: ["кот", "лев"] } },
    ],
  },
  {
    id: "fruits", n: 7, emoji: "🍎", color: "peach",
    title: { en: "Fruits", uz: "Mevalar", ru: "Фрукты" },
    activities: [
      { id: "fruits-same", kind: "find_same", items: ["apple", "banana", "pear", "grapes", "orange", "cherry"] },
      {
        id: "fruits-sort", kind: "sort",
        groups: [
          { label: { en: "Food", uz: "Ovqat", ru: "Еда" }, icon: "🍽️", items: ["apple", "banana", "grapes"] },
          { label: { en: "Transport", uz: "Transport", ru: "Транспорт" }, icon: "🚦", items: ["car", "bus", "boat"] },
        ],
      },
      { id: "fruits-type", kind: "type", mode: "listen", words: { en: ["pear", "lemon"], uz: ["nok", "olma"], ru: ["груша", "арбуз"] } },
    ],
  },
  {
    id: "vegetables", n: 8, emoji: "🥕", color: "leaf",
    title: { en: "Vegetables", uz: "Sabzavotlar", ru: "Овощи" },
    activities: [
      { id: "veg-listen", kind: "listen_pick", items: ["carrot", "tomato", "cucumber", "potato", "onion", "corn"] },
      {
        id: "veg-sort", kind: "sort",
        groups: [
          { label: { en: "Fruits", uz: "Mevalar", ru: "Фрукты" }, icon: "🧺", items: ["apple", "pear", "peach"] },
          { label: { en: "Vegetables", uz: "Sabzavotlar", ru: "Овощи" }, icon: "🥗", items: ["carrot", "cucumber", "tomato"] },
        ],
      },
      { id: "veg-missing", kind: "missing", items: ["carrot", "tomato", "corn", "pepper", "eggplant"] },
    ],
  },
  {
    id: "toys", n: 9, emoji: "🧸", color: "sun",
    title: { en: "Toys", uz: "Oʻyinchoqlar", ru: "Игрушки" },
    activities: [
      { id: "toys-missing", kind: "missing", items: ["ball", "teddy", "kite", "car", "balloon", "drum"] },
      { id: "toys-same", kind: "find_same", items: ["ball", "teddy", "kite", "blocks", "balloon", "yoyo"] },
      { id: "toys-puzzle", kind: "puzzle", item: "teddy", grid: 2 },
    ],
  },
  {
    id: "transport", n: 10, emoji: "🚌", color: "sky",
    title: { en: "Transport", uz: "Transport", ru: "Транспорт" },
    activities: [
      { id: "transport-listen", kind: "listen_pick", items: ["car", "bus", "train", "plane", "bike", "boat", "rocket"] },
      {
        id: "transport-sort", kind: "sort",
        groups: [
          { label: { en: "Sky", uz: "Osmon", ru: "Небо" }, icon: "☁️", items: ["plane", "rocket", "bird"] },
          { label: { en: "Road", uz: "Yoʻl", ru: "Дорога" }, icon: "🛣️", items: ["car", "bus", "truck"] },
        ],
      },
      { id: "transport-type", kind: "type", mode: "word", words: { en: ["bus", "car"], uz: ["qayiq", "avtobus"], ru: ["автобус", "лодка"] } },
    ],
  },
  {
    id: "body", n: 11, emoji: "✋", color: "peach",
    title: { en: "Body parts", uz: "Tana aʼzolari", ru: "Части тела" },
    activities: [
      { id: "body-listen", kind: "listen_pick", items: ["eye", "ear", "nose", "mouth", "hand", "foot"] },
      {
        id: "body-scene", kind: "scene",
        rounds: [
          { scene: "🎵🎶", prompt: { en: "What do we hear music with?", uz: "Musiqani nima bilan eshitamiz?", ru: "Чем мы слышим музыку?" }, options: ["ear", "hand", "foot"], answer: "ear" },
          { scene: "🌷🌸", prompt: { en: "What do we smell flowers with?", uz: "Gulni nima bilan hidlaymiz?", ru: "Чем мы нюхаем цветы?" }, options: ["nose", "ear", "tooth"], answer: "nose" },
          { scene: "⚽🥅", prompt: { en: "What do we kick a ball with?", uz: "Koptokni nima bilan tepamiz?", ru: "Чем мы бьём по мячу?" }, options: ["foot", "eye", "mouth"], answer: "foot" },
        ],
      },
      { id: "body-type", kind: "type", mode: "word", words: { en: ["eye", "ear"], uz: ["tish", "burun"], ru: ["нос", "рот"] } },
    ],
  },
  {
    id: "clothes", n: 12, emoji: "👕", color: "lavender",
    title: { en: "Clothes", uz: "Kiyimlar", ru: "Одежда" },
    activities: [
      { id: "clothes-listen", kind: "listen_pick", items: ["tshirt", "dress", "cap", "socks", "shoes", "coat", "gloves"] },
      {
        id: "clothes-scene", kind: "scene",
        rounds: [
          { scene: "❄️⛄❄️", prompt: { en: "It is cold. What do we put on?", uz: "Havo sovuq. Nima kiyamiz?", ru: "Холодно. Что наденем?" }, options: ["coat", "tshirt", "dress"], answer: "coat" },
          { scene: "🌧️☔🌧️", prompt: { en: "It is raining. What do we take?", uz: "Yomgʻir yogʻyapti. Nima olamiz?", ru: "Идёт дождь. Что возьмём?" }, options: ["umbrella", "ball", "cap"], answer: "umbrella" },
          { scene: "☀️🏖️", prompt: { en: "It is sunny. What do we wear on our head?", uz: "Quyoshli kun. Boshimizga nima kiyamiz?", ru: "Солнечно. Что наденем на голову?" }, options: ["cap", "gloves", "scarf"], answer: "cap" },
        ],
      },
      { id: "clothes-same", kind: "find_same", items: ["tshirt", "dress", "cap", "socks", "shoes", "scarf"] },
    ],
  },
  {
    id: "nature", n: 13, emoji: "🌳", color: "leaf",
    title: { en: "Nature", uz: "Tabiat", ru: "Природа" },
    activities: [
      {
        id: "nature-scene", kind: "scene",
        rounds: [
          { scene: "🌱🌿", prompt: { en: "What does the plant need?", uz: "Nihol nimaga muhtoj?", ru: "Что нужно растению?" }, options: ["sun", "snow"], answer: "sun" },
          { scene: "🌱🏜️", prompt: { en: "The soil is dry. What does the sprout need?", uz: "Tuproq quruq. Niholga nima kerak?", ru: "Земля сухая. Что нужно ростку?" }, options: ["water", "ball"], answer: "water" },
          { scene: "🌙✨", prompt: { en: "It is night. What is in the sky?", uz: "Tun keldi. Osmonda nima bor?", ru: "Наступила ночь. Что на небе?" }, options: ["moon", "sun", "flower"], answer: "moon" },
        ],
      },
      { id: "nature-light", kind: "light_path", length: 4 },
      { id: "nature-path", kind: "path", shape: "hill" },
      { id: "nature-listen", kind: "listen_pick", items: ["sun", "moon", "star", "tree", "flower", "rain", "cloud", "snow"] },
    ],
  },
  {
    id: "words", n: 14, emoji: "📝", color: "sky",
    title: { en: "Simple words", uz: "Oddiy soʻzlar", ru: "Простые слова" },
    activities: [
      { id: "words-type", kind: "type", mode: "word", words: { en: ["sun", "cat", "ball", "tree"], uz: ["oy", "gul", "uy", "non"], ru: ["дом", "мяч", "кот", "сок"] } },
      { id: "words-listen", kind: "type", mode: "listen", words: { en: ["fish", "milk"], uz: ["suv", "qor"], ru: ["луна", "снег"] } },
      { id: "words-zigzag", kind: "path", shape: "zigzag" },
    ],
  },
  {
    id: "sentences", n: 15, emoji: "💬", color: "teal",
    title: { en: "Sentences", uz: "Gaplar", ru: "Предложения" },
    activities: [
      {
        id: "sentences-build", kind: "sentence",
        sentences: {
          en: ["I see a cat", "The sun is warm", "I like apples"],
          uz: ["Men mushukni koʻraman", "Quyosh issiq", "Men olmani yaxshi koʻraman"],
          ru: ["Я вижу кота", "Солнце тёплое", "Я люблю яблоки"],
        },
      },
      { id: "sentences-seq", kind: "sequence", items: ["cat", "sun", "apple", "ball"], length: 3 },
    ],
  },
  {
    id: "stories", n: 16, emoji: "📖", color: "lavender",
    title: { en: "Stories", uz: "Hikoyalar", ru: "Истории" },
    activities: [
      {
        id: "stories-cloud", kind: "story",
        pages: [
          { scene: "☁️🌤️", text: { en: "A little cloud floats in the sky.", uz: "Kichkina bulut osmonda suzib yuribdi.", ru: "Маленькое облачко плывёт по небу." } },
          { scene: "☁️🌱", text: { en: "It sees a small sprout below.", uz: "U pastda kichkina niholni koʻradi.", ru: "Оно видит внизу маленький росток." } },
          { scene: "🌧️🌱", text: { en: "The cloud gives it some rain.", uz: "Bulut unga yomgʻir beradi.", ru: "Облачко дарит ему дождик." } },
          { scene: "🌷😊", text: { en: "The sprout grows into a flower!", uz: "Nihol gulga aylanadi!", ru: "Росток превращается в цветок!" } },
        ],
        question: { scene: "☁️🌧️🌷", prompt: { en: "What did the cloud give?", uz: "Bulut nima berdi?", ru: "Что подарило облачко?" }, options: ["rain", "snow", "ball"], answer: "rain" },
      },
      {
        id: "stories-morning", kind: "story",
        pages: [
          { scene: "🌅🛏️", text: { en: "The sun is up. Good morning!", uz: "Quyosh chiqdi. Xayrli tong!", ru: "Солнце встало. Доброе утро!" } },
          { scene: "🦷✨", text: { en: "We brush our teeth.", uz: "Tishlarimizni yuvamiz.", ru: "Мы чистим зубы." } },
          { scene: "🍞🥛", text: { en: "We eat bread and drink milk.", uz: "Non yeymiz va sut ichamiz.", ru: "Мы едим хлеб и пьём молоко." } },
        ],
        question: { scene: "🦷🌟", prompt: { en: "What do we brush teeth with?", uz: "Tishni nima bilan yuvamiz?", ru: "Чем мы чистим зубы?" }, options: ["toothbrush", "book", "soap"], answer: "toothbrush" },
      },
    ],
  },
];

export const LEVEL_BY_ID: Record<string, Level> = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

/** Free tier: first 4 levels (PRD Q1 proposal). AAC is always free. */
export const FREE_LEVELS = 4;
