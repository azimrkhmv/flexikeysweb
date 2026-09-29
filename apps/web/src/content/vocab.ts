import type { VocabItem } from "@/lib/types";

// Uzbek Latin uses U+02BB (ʻ) for oʻ/gʻ and U+02BC (ʼ) for tutuq belgisi (PRD §9.19).
const v = (id: string, emoji: string, en: string, uz: string, ru: string): VocabItem => ({ id, emoji, word: { en, uz, ru } });

const LIST: VocabItem[] = [
  // fruits
  v("apple", "🍎", "apple", "olma", "яблоко"),
  v("banana", "🍌", "banana", "banan", "банан"),
  v("pear", "🍐", "pear", "nok", "груша"),
  v("grapes", "🍇", "grapes", "uzum", "виноград"),
  v("orange", "🍊", "orange", "apelsin", "апельсин"),
  v("cherry", "🍒", "cherry", "olcha", "вишня"),
  v("strawberry", "🍓", "strawberry", "qulupnay", "клубника"),
  v("watermelon", "🍉", "watermelon", "tarvuz", "арбуз"),
  v("lemon", "🍋", "lemon", "limon", "лимон"),
  v("peach", "🍑", "peach", "shaftoli", "персик"),
  // vegetables
  v("carrot", "🥕", "carrot", "sabzi", "морковь"),
  v("tomato", "🍅", "tomato", "pomidor", "помидор"),
  v("cucumber", "🥒", "cucumber", "bodring", "огурец"),
  v("potato", "🥔", "potato", "kartoshka", "картошка"),
  v("onion", "🧅", "onion", "piyoz", "лук"),
  v("corn", "🌽", "corn", "makkajoʻxori", "кукуруза"),
  v("pepper", "🫑", "pepper", "qalampir", "перец"),
  v("eggplant", "🍆", "eggplant", "baqlajon", "баклажан"),
  // animals
  v("cat", "🐱", "cat", "mushuk", "кошка"),
  v("dog", "🐶", "dog", "it", "собака"),
  v("cow", "🐮", "cow", "sigir", "корова"),
  v("horse", "🐴", "horse", "ot", "лошадь"),
  v("sheep", "🐑", "sheep", "qoʻy", "овца"),
  v("bird", "🐦", "bird", "qush", "птица"),
  v("fish", "🐟", "fish", "baliq", "рыба"),
  v("rabbit", "🐰", "rabbit", "quyon", "кролик"),
  v("bear", "🐻", "bear", "ayiq", "медведь"),
  v("lion", "🦁", "lion", "sher", "лев"),
  v("chicken", "🐔", "chicken", "tovuq", "курица"),
  v("frog", "🐸", "frog", "qurbaqa", "лягушка"),
  // toys
  v("ball", "⚽", "ball", "koptok", "мяч"),
  v("teddy", "🧸", "teddy bear", "ayiqcha", "мишка"),
  v("kite", "🪁", "kite", "varrak", "воздушный змей"),
  v("blocks", "🧱", "blocks", "kubiklar", "кубики"),
  v("balloon", "🎈", "balloon", "shar", "шарик"),
  v("drum", "🥁", "drum", "baraban", "барабан"),
  v("yoyo", "🪀", "yo-yo", "yo-yo", "йо-йо"),
  v("puzzle", "🧩", "puzzle", "boshqotirma", "пазл"),
  // transport
  v("car", "🚗", "car", "mashina", "машина"),
  v("bus", "🚌", "bus", "avtobus", "автобус"),
  v("train", "🚂", "train", "poyezd", "поезд"),
  v("plane", "✈️", "plane", "samolyot", "самолёт"),
  v("bike", "🚲", "bike", "velosiped", "велосипед"),
  v("boat", "⛵", "boat", "qayiq", "лодка"),
  v("truck", "🚚", "truck", "yuk mashinasi", "грузовик"),
  v("rocket", "🚀", "rocket", "raketa", "ракета"),
  v("tractor", "🚜", "tractor", "traktor", "трактор"),
  // body
  v("eye", "👁️", "eye", "koʻz", "глаз"),
  v("ear", "👂", "ear", "quloq", "ухо"),
  v("nose", "👃", "nose", "burun", "нос"),
  v("mouth", "👄", "mouth", "ogʻiz", "рот"),
  v("hand", "✋", "hand", "qoʻl", "рука"),
  v("foot", "🦶", "foot", "oyoq", "нога"),
  v("tooth", "🦷", "tooth", "tish", "зуб"),
  // clothes
  v("tshirt", "👕", "T-shirt", "futbolka", "футболка"),
  v("dress", "👗", "dress", "koʻylak", "платье"),
  v("cap", "🧢", "cap", "kepka", "кепка"),
  v("socks", "🧦", "socks", "paypoq", "носки"),
  v("shoes", "👟", "shoes", "krossovka", "кроссовки"),
  v("coat", "🧥", "coat", "palto", "пальто"),
  v("gloves", "🧤", "gloves", "qoʻlqop", "перчатки"),
  v("scarf", "🧣", "scarf", "sharf", "шарф"),
  // nature
  v("sun", "☀️", "sun", "quyosh", "солнце"),
  v("moon", "🌙", "moon", "oy", "луна"),
  v("star", "⭐", "star", "yulduz", "звезда"),
  v("tree", "🌳", "tree", "daraxt", "дерево"),
  v("flower", "🌷", "flower", "gul", "цветок"),
  v("rain", "🌧️", "rain", "yomgʻir", "дождь"),
  v("cloud", "☁️", "cloud", "bulut", "облако"),
  v("snow", "❄️", "snow", "qor", "снег"),
  v("leaf", "🍃", "leaf", "barg", "лист"),
  v("water", "💧", "water", "suv", "вода"),
  v("seedling", "🌱", "sprout", "nihol", "росток"),
  // family
  v("mother", "👩", "mother", "ona", "мама"),
  v("father", "👨", "father", "ota", "папа"),
  v("baby", "👶", "baby", "chaqaloq", "малыш"),
  v("grandma", "👵", "grandma", "buvi", "бабушка"),
  v("grandpa", "👴", "grandpa", "bobo", "дедушка"),
  v("sister", "👧", "sister", "opa", "сестра"),
  v("brother", "👦", "brother", "aka", "брат"),
  // food & home (stories / scenes)
  v("bread", "🍞", "bread", "non", "хлеб"),
  v("milk", "🥛", "milk", "sut", "молоко"),
  v("soup", "🍲", "soup", "shoʻrva", "суп"),
  v("bed", "🛏️", "bed", "karavot", "кровать"),
  v("house", "🏠", "house", "uy", "дом"),
  v("umbrella", "☂️", "umbrella", "soyabon", "зонт"),
  v("toothbrush", "🪥", "toothbrush", "tish choʻtkasi", "зубная щётка"),
  v("book", "📖", "book", "kitob", "книга"),
  v("soap", "🧼", "soap", "sovun", "мыло"),
];

const COLORS: VocabItem[] = [
  { id: "c_red", color: "#e8837a", word: { en: "red", uz: "qizil", ru: "красный" } },
  { id: "c_blue", color: "#7fa9e0", word: { en: "blue", uz: "koʻk", ru: "синий" } },
  { id: "c_green", color: "#8cc98f", word: { en: "green", uz: "yashil", ru: "зелёный" } },
  { id: "c_yellow", color: "#f5d272", word: { en: "yellow", uz: "sariq", ru: "жёлтый" } },
  { id: "c_purple", color: "#b3a8e8", word: { en: "purple", uz: "binafsha", ru: "фиолетовый" } },
  { id: "c_orange", color: "#f4b183", word: { en: "orange", uz: "toʻq sariq", ru: "оранжевый" } },
  { id: "c_pink", color: "#f3b6c8", word: { en: "pink", uz: "pushti", ru: "розовый" } },
  { id: "c_white", color: "#fbfbf8", word: { en: "white", uz: "oq", ru: "белый" } },
];

const SHAPES: VocabItem[] = [
  { id: "s_circle", shape: "circle", word: { en: "circle", uz: "doira", ru: "круг" } },
  { id: "s_square", shape: "square", word: { en: "square", uz: "kvadrat", ru: "квадрат" } },
  { id: "s_triangle", shape: "triangle", word: { en: "triangle", uz: "uchburchak", ru: "треугольник" } },
  { id: "s_star", shape: "star", word: { en: "star", uz: "yulduz", ru: "звезда" } },
  { id: "s_heart", shape: "heart", word: { en: "heart", uz: "yurak", ru: "сердце" } },
  { id: "s_rectangle", shape: "rectangle", word: { en: "rectangle", uz: "toʻrtburchak", ru: "прямоугольник" } },
];

const NUM_WORDS: [string, string, string][] = [
  ["one", "bir", "один"], ["two", "ikki", "два"], ["three", "uch", "три"], ["four", "toʻrt", "четыре"],
  ["five", "besh", "пять"], ["six", "olti", "шесть"], ["seven", "yetti", "семь"], ["eight", "sakkiz", "восемь"],
  ["nine", "toʻqqiz", "девять"], ["ten", "oʻn", "десять"],
];
const NUMBERS: VocabItem[] = NUM_WORDS.map(([en, uz, ru], i) => ({ id: `n_${i + 1}`, glyph: String(i + 1), word: { en, uz, ru } }));

export const VOCAB: Record<string, VocabItem> = Object.fromEntries(
  [...LIST, ...COLORS, ...SHAPES, ...NUMBERS].map((x) => [x.id, x]),
);

export const vocab = (id: string): VocabItem => {
  const item = VOCAB[id];
  if (!item) throw new Error(`Unknown vocab id: ${id}`);
  return item;
};
