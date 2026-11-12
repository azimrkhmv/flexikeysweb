import type { Lang } from "@/lib/i18n";

// Word lists of the language games (games spec 8 Nov 2026, §5 listen_pick and type; §6.6 rhyme). Each language has its
// OWN lists: similar sounds and rhymes are never translated. Every word has a picture (an Emoji ≤ 12, see
// emoji.test.ts). uz text drafted 8 Nov 2026 — native-speaker check (B44).

export interface PicWord {
  word: string;
  emoji: string;
}
const w = (s: string): PicWord[] =>
  s.split(",").map((x) => {
    const [word, emoji] = x.trim().split(" ");
    return { word, emoji };
  });

/**
 * Groups of words that sound alike (listen_pick's Summit: "6 options with similar sounds, bus / bun"). A round's
 * options come from one group first, so the child must listen to the whole word.
 */
export const SOUND_GROUPS: Record<Lang, PicWord[][]> = {
  en: [
    w("cat 🐱, hat 🎩, bat 🦇, rat 🐀, cap 🧢, cup ☕"),
    w("bee 🐝, key 🔑, tree 🌳, tea 🍵, three 3️⃣"),
    w("bus 🚌, bug 🐛, bag 👜, bun 🍔, bud 🌱"),
    w("pen 🖊️, hen 🐔, ten 🔟, pin 📌, pan 🍳"),
    w("boat ⛵, goat 🐐, coat 🧥, note 🎵"),
    w("moon 🌙, spoon 🥄, balloon 🎈, raccoon 🦝"),
    w("mouse 🐭, house 🏠, horse 🐴"),
    w("frog 🐸, dog 🐶, fog 🌫️, flag 🚩"),
    w("ship 🚢, sheep 🐑, chips 🍟, cheese 🧀"),
    w("bear 🐻, pear 🍐, chair 🪑, hair 💇"),
    w("box 📦, fox 🦊, socks 🧦, clock 🕐, lock 🔒"),
    w("bell 🔔, shell 🐚, ball ⚽, bowl 🥣"),
    w("nose 👃, rose 🌹, toes 🦶, bows 🎀"),
    w("kite 🪁, light 💡, night 🌃, knife 🔪"),
    w("train 🚂, rain 🌧️, plane ✈️, chain ⛓️"),
    w("car 🚗, star ⭐, guitar 🎸, jar 🍯"),
    w("cake 🍰, snake 🐍, lake 🏞️, steak 🥩"),
    w("ring 💍, king 🤴, wing 🦅, swing 🎠"),
  ],
  ru: [
    w("кот 🐱, кит 🐋, рот 👄, торт 🎂"),
    w("мышка 🐭, мишка 🧸, миска 🥣, фишка 🎲"),
    w("дом 🏠, дым 💨, гном 🧙, сом 🐟"),
    w("лук 🧅, жук 🐞, люк 🕳️, звук 🔊"),
    w("коза 🐐, роза 🌹, глаза 👀, гроза ⛈️"),
    w("ложка 🥄, кошка 🐈, картошка 🥔"),
    w("мак 🌺, рак 🦞, флаг 🚩, фрак 🤵"),
    w("ёлка 🎄, пчёлка 🐝, полка 📚, юбка 👗"),
    w("уточка 🦆, удочка 🎣, булочка 🥐, дудочка 🎺"),
    w("лягушка 🐸, игрушка 🪀, кружка ☕, подушка 🛏️"),
    w("мяч ⚽, врач 🩺, калач 🥨, грач 🐦"),
    w("зайка 🐰, майка 👕, гайка 🔩, чайка 🕊️"),
    w("дочка 👧, бочка 🛢️, почка 🌱, точка ⚫"),
    w("луна 🌙, волна 🌊, стена 🧱, струна 🎻"),
    w("сова 🦉, трава 🌿, голова 🙂, корова 🐄"),
    w("часы ⌚, весы ⚖️, усы 👨, бусы 📿"),
    w("шар 🎈, жар 🔥, пар ♨️, комар 🦟"),
    w("сыр 🧀, мир 🌍, тигр 🐯, пир 🍽️"),
  ],
  uz: [
    w("qoʻl ✋, yoʻl 🛣️, koʻl 🏞️, choʻl 🏜️"),
    w("oy 🌙, uy 🏠, toy 💒, choy 🍵"),
    w("ot 🐴, it 🐶, oʻt 🔥, et 🥩"),
    w("non 🍞, nok 🍐, nol 0️⃣, nay 🎶"),
    w("tish 🦷, qish ❄️, qoshiq 🥄, shisha 🍾"),
    w("gul 🌷, pul 💵, gol ⚽, gilos 🍒"),
    w("bola 👦, xola 👩, lola 🌺, tola 🧵"),
    w("olma 🍎, olmos 💎, olov 🔥, oltin 🥇"),
    w("tuz 🧂, yuz 🙂, muz 🧊, qiz 👧"),
    w("kit 🐋, kitob 📖, kepka 🧢, kema 🚢, kalit 🔑, kaptar 🕊️"),
    w("qor ⛄, qoʻy 🐑, qozon 🍲, qovun 🍈"),
    w("sut 🥛, tut 🍇, sumka 👜, suv 💧"),
    w("ari 🐝, archa 🎄, arava 🛒, ayiq 🐻"),
    w("baliq 🐟, bulut ☁️, bodring 🥒, burun 👃"),
    w("qush 🐦, quloq 👂, quyon 🐰, quyosh ☀️"),
  ],
};

/**
 * Rhyme families (rhyme's rounds, §6.6): every word of a family rhymes with the others, and with no word of another
 * family. Pairs per language (n·(n−1)/2 per family) are at least 30 (games.test.ts).
 */
export const RHYMES: Record<Lang, PicWord[][]> = {
  en: [
    w("cat 🐱, hat 🎩, bat 🦇"),
    w("bee 🐝, tree 🌳, key 🔑, three 3️⃣"),
    w("mouse 🐭, house 🏠"),
    w("frog 🐸, dog 🐶"),
    w("bear 🐻, pear 🍐, chair 🪑, hair 💇"),
    w("moon 🌙, spoon 🥄, balloon 🎈"),
    w("goat 🐐, boat ⛵, coat 🧥"),
    w("snake 🐍, cake 🍰"),
    w("king 🤴, ring 💍"),
    w("star ⭐, car 🚗, jar 🍯"),
    w("fox 🦊, box 📦, socks 🧦"),
    w("rain 🌧️, train 🚂, plane ✈️, chain ⛓️"),
    w("bell 🔔, shell 🐚"),
    w("nose 👃, rose 🌹, toes 🦶"),
    w("clock 🕐, lock 🔒"),
    w("fish 🐟, dish 🍽️"),
    w("pen 🖊️, hen 🐔, ten 🔟"),
    w("kite 🪁, light 💡"),
    w("tie 👔, pie 🥧, eye 👁️"),
    w("whale 🐋, snail 🐌, nail 💅, mail 📬"),
    w("ball ⚽, wall 🧱"),
  ],
  ru: [
    w("коза 🐐, роза 🌹, гроза ⛈️, глаза 👀"),
    w("ложка 🥄, кошка 🐈, картошка 🥔"),
    w("мак 🌺, рак 🦞, флаг 🚩"),
    w("жук 🐞, лук 🧅"),
    w("сова 🦉, трава 🌿"),
    w("луна 🌙, волна 🌊, стена 🧱"),
    w("часы ⌚, весы ⚖️, бусы 📿"),
    w("мишка 🧸, мышка 🐭"),
    w("зайка 🐰, майка 👕, гайка 🔩"),
    w("дочка 👧, бочка 🛢️, точка ⚫"),
    w("мяч ⚽, врач 🩺, калач 🥨"),
    w("шар 🎈, комар 🦟"),
    w("дом 🏠, гном 🧙, сом 🐟"),
    w("кружка ☕, игрушка 🪀, лягушка 🐸"),
    w("ёлка 🎄, пчёлка 🐝"),
    w("сок 🧃, носок 🧦"),
    w("нож 🔪, ёж 🦔"),
    w("банан 🍌, барабан 🥁, диван 🛋️"),
  ],
  uz: [
    w("qoʻl ✋, yoʻl 🛣️, koʻl 🏞️, choʻl 🏜️"),
    w("oy 🌙, toy 💒, choy 🍵, qoʻy 🐑"),
    w("non 🍞, son 🔢, quyon 🐰, ilon 🐍"),
    w("gul 🌷, pul 💵"),
    w("tuz 🧂, muz 🧊, yuz 🙂, kuz 🍂"),
    w("bola 👦, lola 🌺, xola 👩"),
    w("it 🐶, kit 🐋"),
    w("tovuq 🐔, sovuq 🥶"),
    w("uy 🏠, kuy 🎵"),
    w("tish 🦷, qish ❄️"),
    w("qovun 🍈, sovun 🧼"),
    w("ari 🐝, pari 🧚"),
    w("qalam ✏️, olam 🌍"),
  ],
};

/** Take one sound away (rhyme's Summit, §6.6): the word, the sound taken away, and the word left. */
export interface DropWord {
  from: PicWord;
  sound: string;
  to: PicWord;
}
const d = (s: string): DropWord[] =>
  s.split(",").map((x) => {
    const [from, fromEmoji, sound, to, toEmoji] = x.trim().split(" ");
    return { from: { word: from, emoji: fromEmoji }, sound, to: { word: to, emoji: toEmoji } };
  });
export const DROPS: Record<Lang, DropWord[]> = {
  en: d("train 🚂 t rain 🌧️, clock 🕐 c lock 🔒, fox 🦊 f ox 🐂, pear 🍐 p ear 👂, bowl 🥣 b owl 🦉, frog 🐸 r fog 🌫️, pants 👖 p ants 🐜, snail 🐌 s nail 💅"),
  ru: d("гроза ⛈️ г роза 🌹, слон 🐘 л сон 😴, шарф 🧣 ф шар 🎈, уточка 🦆 у точка ⚫, волк 🐺 к вол 🐂, скот 🐄 с кот 🐱, краска 🎨 р каска ⛑️"),
  uz: d("kuy 🎵 k uy 🏠, toy 💒 t oy 🌙, choy 🍵 ch oy 🌙, kit 🐋 k it 🐶, ota 👨 a ot 🐴"),
};

/** Short sentences to type from hearing them (type's Summit: "a whole short sentence from hearing it"). */
export const TYPE_SENTENCES: Record<Lang, string[]> = {
  en: [
    "cats sleep", "birds fly", "I jump", "we sing", "dogs run",
    "we like milk", "I can sit", "a big bus", "I am happy", "we can play",
    "I see a cat", "the sun is hot", "a dog can run", "the fish is red", "my cup is blue", "I go to school",
  ],
  ru: [
    "мама дома", "кот спит", "мы играем", "папа читает", "дом большой", "мяч красный",
    "я вижу кота", "мы едим суп", "я иду гулять", "у кошки хвост", "вот мой мяч", "я люблю маму",
    "мы идём в парк", "я играю с мячом", "у меня есть кот", "мама варит вкусный суп",
  ],
  uz: [
    "mushuk uxlaydi", "it yuguradi", "quyosh issiq", "biz oʻynaymiz", "koptok qizil", "qush uchadi",
    "men olma yeyman", "bu mening uyim", "men suv ichaman", "ona non oldi", "men kitob oʻqiyman", "bu katta uy",
    "bu mening katta uyim", "men onam bilan yuraman", "it bogʻda tez yuguradi", "biz bugun koptok oʻynaymiz",
  ],
};

/** Short words to type, by language, shortest first. */
export const TYPE_WORDS: Record<Lang, string[]> = {
  en: ["up", "go", "me", "we", "on", "in", "sun", "cat", "dog", "hat", "bed", "cup", "map", "red", "fox", "bus", "milk", "ball", "fish", "tree", "frog", "duck", "book", "cake", "house", "apple", "chair", "plant", "sheep", "train", "rabbit", "flower", "school", "garden"],
  ru: ["да", "мы", "он", "кот", "дом", "сок", "мяч", "лук", "сыр", "нос", "рот", "суп", "мама", "папа", "луна", "рыба", "каша", "сова", "кино", "лиса", "банан", "книга", "мишка", "кошка", "собака", "машина", "дерево", "яблоко"],
  uz: [
    "uy", "oy", "it", "ot", "non", "gul", "suv", "qor", "tuz", "muz", "ona", "ota", "nok", "kit", "toʻp",
    "olma", "qush", "anor", "bola", "tosh", "ilon", "xona", "uzum",
    "baliq", "sabzi", "bulut", "kitob", "tovuq", "sigir", "mushuk", "daraxt", "yulduz", "quyosh", "qoʻgʻirchoq",
  ],
};
