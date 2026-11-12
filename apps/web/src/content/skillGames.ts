import type { CountSettings, FindSameSettings, LightPathSettings, ListenPickSettings, MazeSettings, MissingSettings, PuzzleSettings, SceneSettings, SequenceSettings, SortSettings, StorySettings, TypeSettings } from "@/lib/games/existing";
import type { SkillKind } from "@/lib/games";
import type { OddOneOutSettings, TrackFishSettings, WhichWaySettings } from "@/lib/games/attention";
import type { CardPairsSettings, NBackSettings, PairsRecallSettings, ShoppingSettings } from "@/lib/games/memory";
import type { OppositeSettings, SecretRuleSettings, SwitchSortSettings } from "@/lib/games/flexibility";
import type { BalanceSettings, LogicHousesSettings, NextPatternSettings, PipesSettings, ShadowSettings } from "@/lib/games/reasoning";
import type { BazaarSettings, MissingNumberSettings, MoreLessSettings, NumberLineSettings } from "@/lib/games/math";
import type { RhymeSettings, SaySettings, WordBuilderSettings } from "@/lib/games/language";
import { AREA_OF, type Area, type StepN, type Tier } from "@/lib/skill";
import type { ActivityStep, InputModeId, L10n } from "@/lib/types";

// Skill games (games spec 8 Nov 2026, §2.3, §5, §6): one game per kind, `<kind>-skill`, with 12 steps — tiers Seed,
// Sprout, Tree, Summit × steps 1–3, each a little harder than the one before. A step's settings go to the kind's
// round generator (lib/games); its `can_do` is the sentence the parent panel shows.
// uz text drafted 8 Nov 2026 — native-speaker check (B44).

export interface SkillGame<S = Record<string, unknown>> {
  id: string;
  kind: SkillKind;
  area: Area;
  theme: "mixed";
  input_modes: InputModeId[];
  steps: ActivityStep<S>[];
}

const ALL_MODES: InputModeId[] = ["touch", "dwell", "switch", "keyboard"];
/** Russian plural: 1 картинка · 2 картинки · 5 картинок. */
const pl = (n: number, one: string, few: string, many: string) => {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
const range = (min = 1, max = 99) => (min === max ? `${min}` : max >= 99 ? `${min}+` : `${min}–${max}`);

function game<S>(kind: SkillKind, table: S[], canDo: (s: S) => L10n, needs?: (s: S) => ActivityStep["needs"]): SkillGame<S> {
  if (table.length !== 12) throw new Error(`${kind}: 12 steps, not ${table.length}`);
  return {
    id: `${kind}-skill`,
    kind,
    area: AREA_OF[kind],
    theme: "mixed",
    input_modes: ALL_MODES,
    steps: table.map((settings, k) => ({ tier: (Math.floor(k / 3) + 1) as Tier, step: ((k % 3) + 1) as StepN, settings, can_do: canDo(settings), ...(needs?.(settings) ? { needs: needs(settings) } : {}) })),
  };
}

// ---------------------------------------------------------------- the step tables (Seed 1 … Summit 3)
const findSame = game<FindSameSettings>(
  "find_same",
  [
    { options: 3, mode: "items" }, { options: 4, mode: "items" }, { options: 4, mode: "shapes" },
    { options: 5, mode: "shapes" }, { options: 6, mode: "shapes" }, { options: 6, mode: "colors" },
    { options: 8, mode: "colors" }, { options: 9, mode: "turn" }, { options: 10, mode: "turn" },
    { options: 12, mode: "fine" }, { options: 14, mode: "fine" }, { options: 16, mode: "fine" },
  ],
  ({ options: n, mode }) =>
    ({
      items: { en: `Finds the same picture among ${n}`, ru: `Находит такую же картинку среди ${n} ${pl(n, "картинки", "картинок", "картинок")}`, uz: `${n} ta rasm ichidan xuddi shunday rasmni topadi` },
      shapes: { en: `Finds the same shape among ${n}`, ru: `Находит такую же фигуру среди ${n} фигур`, uz: `${n} ta shakl ichidan xuddi shunday shaklni topadi` },
      colors: { en: `Finds the same colour among ${n}`, ru: `Находит такой же цвет среди ${n} цветов`, uz: `${n} ta rang ichidan xuddi shunday rangni topadi` },
      turn: { en: `Finds the shape turned the same way among ${n}`, ru: `Находит так же повёрнутую фигуру среди ${n} фигур`, uz: `${n} ta shakl ichidan xuddi shunday burilgan shaklni topadi` },
      fine: { en: `Spots a small turn or shade among ${n} shapes`, ru: `Замечает небольшой поворот или оттенок среди ${n} фигур`, uz: `${n} ta shakl ichidan kichik burilish yoki tusni sezadi` },
    })[mode],
);

const scene = game<SceneSettings>(
  "scene",
  [
    { objects: 3, options: 2 }, { objects: 3, options: 3 }, { objects: 4, options: 3 },
    { objects: 5, options: 3 }, { objects: 6, options: 3 }, { objects: 7, options: 4 },
    { objects: 9, options: 4, small: true }, { objects: 10, options: 4, small: true, hidden: 2 }, { objects: 12, options: 4, small: true, hidden: 3 },
    { objects: 15, options: 4, small: true, hidden: 4 }, { objects: 16, options: 5, small: true, hidden: 5 }, { objects: 18, options: 6, small: true, hidden: 6 },
  ],
  ({ objects: n, options: k, small, hidden }) => ({
    en: `Finds which of ${k} pictures is in a scene of ${n}${small ? " small" : ""} things${hidden ? ", some half hidden" : ""}`,
    ru: `Находит, какая из ${k} картинок есть на рисунке из ${n} ${small ? "маленьких " : ""}предметов${hidden ? ", даже наполовину спрятанных" : ""}`,
    uz: `${n} ta ${small ? "kichik " : ""}narsali rasmda ${k} ta rasmdan qaysi biri borligini topadi${hidden ? ", yarim yashiringanlarini ham" : ""}`,
  }),
);

const PAGES = { 1: 3, 2: 4, 3: 5, 4: 6 } as const;
const story = game<StorySettings>(
  "story",
  [
    { set: 1, questions: 1, options: 2 }, { set: 1, questions: 1, options: 3 }, { set: 1, questions: 2, options: 3 },
    { set: 2, questions: 1, options: 3 }, { set: 2, questions: 2, options: 3 }, { set: 2, questions: 2, options: 4 },
    { set: 3, questions: 2, options: 3 }, { set: 3, questions: 2, options: 4 }, { set: 3, questions: 3, options: 4 },
    { set: 4, questions: 2, options: 4 }, { set: 4, questions: 3, options: 3 }, { set: 4, questions: 3, options: 4 },
  ],
  ({ set, questions: q, options: k }) => {
    // Tree stories ask about the order in their 3rd question, Summit stories in their 2nd.
    const order = (set === 3 && q >= 3) || (set === 4 && q >= 2);
    return {
      en: `Answers ${q} question${q > 1 ? "s" : ""} about a story of ${PAGES[set]} pictures${order ? ", also about the order" : ""}, choosing from ${k}`,
      ru: `Отвечает на ${q} ${pl(q, "вопрос", "вопроса", "вопросов")} по рассказу из ${PAGES[set]} картинок${order ? ", в том числе о порядке" : ""}, выбирая из ${k}`,
      uz: `${PAGES[set]} ta rasmli hikoya boʻyicha ${q} ta savolga ${k} ta javobdan tanlab javob beradi${order ? ", tartib haqida ham" : ""}`,
    };
  },
);

const sequence = game<SequenceSettings>(
  "sequence",
  [
    { length: 2, pool: 3 }, { length: 3, pool: 3 }, { length: 3, pool: 4 },
    { length: 4, pool: 4 }, { length: 4, pool: 5 }, { length: 5, pool: 5 },
    { length: 5, pool: 6 }, { length: 6, pool: 6 }, { length: 6, pool: 7 },
    { length: 7, pool: 7 }, { length: 6, pool: 7, order: "backward" }, { length: 7, pool: 7, order: "both" },
  ],
  ({ length: n, pool: k, order = "forward" }) => {
    const base = {
      forward: { en: `Remembers ${n} pictures in order`, ru: `Запоминает ${n} ${pl(n, "картинку", "картинки", "картинок")} по порядку`, uz: `${n} ta rasmni tartib bilan eslab qoladi` },
      backward: { en: `Remembers ${n} pictures and repeats them backward`, ru: `Запоминает ${n} ${pl(n, "картинку", "картинки", "картинок")} и повторяет их в обратном порядке`, uz: `${n} ta rasmni eslab, teskari tartibda takrorlaydi` },
      both: { en: `Repeats ${n} pictures in order and then backward`, ru: `Повторяет ${n} ${pl(n, "картинку", "картинки", "картинок")} по порядку, а потом в обратном порядке`, uz: `${n} ta rasmni tartib bilan, keyin teskari tartibda takrorlaydi` },
    }[order];
    return k > n ? { en: `${base.en}, out of ${k}`, ru: `${base.ru}, выбирая из ${k}`, uz: `${k} ta rasm ichidan ${base.uz}` } : base;
  },
);

const missing = game<MissingSettings>(
  "missing",
  [
    { shown: 3, options: 2 }, { shown: 4, options: 2 }, { shown: 4, options: 3 },
    { shown: 5, options: 3 }, { shown: 5, options: 4 }, { shown: 6, options: 4 },
    { shown: 6, gone: 2, options: 4 }, { shown: 7, gone: 2, options: 4 }, { shown: 7, options: 4, change: "swap" },
    { shown: 8, gone: 2, options: 4 }, { shown: 8, options: 4, change: "swap" }, { shown: 8, gone: 2, options: 4, change: "mixed" },
  ],
  ({ shown: n, gone = 1, change = "gone", options: k }) =>
    change === "swap"
      ? { en: `Notices which 2 of ${n} pictures swapped places`, ru: `Замечает, какие 2 из ${n} картинок поменялись местами`, uz: `${n} ta rasmdan qaysi 2 tasi oʻrin almashganini sezadi` }
      : change === "mixed"
        ? { en: `Notices 2 pictures gone or swapped among ${n}`, ru: `Замечает 2 пропавшие или переставленные картинки среди ${n}`, uz: `${n} ta rasm ichida yoʻqolgan yoki oʻrin almashgan 2 tasini sezadi` }
        : gone === 2
          ? { en: `Notices which 2 of ${n} pictures are gone`, ru: `Замечает, какие 2 из ${n} картинок пропали`, uz: `${n} ta rasmdan qaysi 2 tasi yoʻqolganini sezadi` }
          : { en: `Notices which of ${n} pictures is gone, choosing from ${k}`, ru: `Замечает, какая из ${n} картинок пропала, выбирая из ${k}`, uz: `${n} ta rasmdan qaysi biri yoʻqolganini ${k} ta javobdan tanlab sezadi` },
);

const lightPath = game<LightPathSettings>(
  "light_path",
  [
    { grid: 3, length: 3 }, { grid: 3, length: 4 }, { grid: 4, length: 4 },
    { grid: 4, length: 5 }, { grid: 4, length: 6 }, { grid: 5, length: 5 },
    { grid: 5, length: 6 }, { grid: 5, length: 7 }, { grid: 5, length: 8 },
    { grid: 5, length: 7, reverse: true }, { grid: 5, length: 8, reverse: true }, { grid: 5, length: 9, reverse: true },
  ],
  ({ grid: g, length: n, reverse }) => ({
    en: `Repeats a path of ${n} stars on a ${g}×${g} grid${reverse ? ", backward" : ""}`,
    ru: `Повторяет путь из ${n} звёзд на поле ${g}×${g}${reverse ? " в обратном порядке" : ""}`,
    uz: `${g}×${g} maydonda ${n} ta yulduz yoʻlini ${reverse ? "teskari " : ""}takrorlaydi`,
  }),
);

const sort = game<SortSettings>(
  "sort",
  [
    { groups: 2, items: 4, by: "category" }, { groups: 2, items: 6, by: "category" }, { groups: 2, items: 8, by: "category" },
    { groups: 3, items: 6, by: "category" }, { groups: 3, items: 9, by: "category" }, { groups: 2, items: 6, by: "color" },
    { groups: 3, items: 9, by: "color" }, { groups: 3, items: 9, by: "shape" }, { groups: 4, items: 8, by: "category" },
    { groups: 4, items: 12, by: "two" }, { groups: 4, items: 14, by: "two" }, { groups: 4, items: 16, by: "two" },
  ],
  ({ groups: g, items: n, by }) =>
    ({
      category: { en: `Sorts ${n} pictures into ${g} groups`, ru: `Раскладывает ${n} ${pl(n, "картинку", "картинки", "картинок")} по ${g} группам`, uz: `${n} ta rasmni ${g} guruhga ajratadi` },
      color: { en: `Sorts ${n} shapes by colour into ${g} boxes`, ru: `Раскладывает ${n} фигур по цвету в ${g} коробки`, uz: `${n} ta shaklni rangiga qarab ${g} qutiga ajratadi` },
      shape: { en: `Sorts ${n} shapes by their form into ${g} boxes`, ru: `Раскладывает ${n} фигур по форме в ${g} коробки`, uz: `${n} ta shaklni koʻrinishiga qarab ${g} qutiga ajratadi` },
      two: { en: `Sorts ${n} shapes by colour and form at once`, ru: `Раскладывает ${n} фигур сразу по цвету и форме`, uz: `${n} ta shaklni bir vaqtda rangi va koʻrinishiga qarab ajratadi` },
    })[by],
);

const maze = game<MazeSettings>(
  "maze",
  [
    { size: 3 }, { size: 4 }, { size: 5 },
    { size: 5, key: true }, { size: 6 }, { size: 6, key: true },
    { size: 7 }, { size: 7, key: true }, { size: 8 },
    { size: 8, key: true }, { size: 9 }, { size: 9, key: true },
  ],
  ({ size: n, key }) => ({
    en: `Finds the way through a ${n}×${n} maze${key ? ", with a key and a door" : ""}`,
    ru: `Находит путь в лабиринте ${n}×${n}${key ? " с ключом и дверью" : ""}`,
    uz: `${n}×${n} labirintdan yoʻl topadi${key ? ", kalit va eshik bilan" : ""}`,
  }),
);

const puzzle = game<PuzzleSettings>(
  "puzzle",
  [
    { grid: 2 }, { grid: 3 }, { grid: 3, turned: "some" },
    { grid: 3, turned: "all" }, { grid: 4 }, { grid: 4, turned: "some" },
    { grid: 4, turned: "all" }, { grid: 5 }, { grid: 5, turned: "some" },
    { grid: 5, turned: "all" }, { grid: 5, turned: "some", preview: false }, { grid: 5, turned: "all", preview: false },
  ],
  ({ grid: g, turned = "none", preview = true }) => ({
    en: `Puts together a ${g}×${g} picture${turned === "some" ? ", turning some pieces" : turned === "all" ? ", turning every piece" : ""}${preview ? "" : ", without a sample"}`,
    ru: `Собирает картинку ${g}×${g}${turned === "some" ? ", поворачивая некоторые части" : turned === "all" ? ", поворачивая все части" : ""}${preview ? "" : ", без образца"}`,
    uz: `${g}×${g} rasmni ${turned === "some" ? "ayrim boʻlaklarini burib " : turned === "all" ? "hamma boʻlaklarini burib " : ""}${preview ? "" : "namunasiz "}yigʻadi`,
  }),
);

const listenPick = game<ListenPickSettings>(
  "listen_pick",
  [
    { options: 2 }, { options: 3 }, { options: 4 },
    { options: 2, similar: true }, { options: 3, similar: true }, { options: 4, similar: true },
    { options: 4, similar: true, noWord: true }, { options: 5, similar: true }, { options: 6 },
    { options: 5, similar: true, noWord: true }, { options: 6, similar: true }, { options: 6, similar: true, noWord: true },
  ],
  ({ options: n, similar, noWord }) => ({
    en: `Finds the word heard among ${n} ${similar ? "words that sound alike" : "pictures"}${noWord ? ", without seeing it written" : ""}`,
    ru: `Находит услышанное слово среди ${n} ${similar ? "похожих по звучанию слов" : "картинок"}${noWord ? ", не видя его написанным" : ""}`,
    uz: `${n} ta ${similar ? "ohangdosh soʻz" : "rasm"} ichidan eshitgan soʻzini ${noWord ? "yozilganini koʻrmasdan " : ""}topadi`,
  }),
);

const type = game<TypeSettings>(
  "type",
  [
    { mode: "letter" }, { mode: "word", min: 2, max: 3 }, { mode: "word", min: 3, max: 4 },
    { mode: "word", min: 4, max: 5 }, { mode: "listen", min: 2, max: 3 }, { mode: "listen", min: 3, max: 4 },
    { mode: "listen", min: 4, max: 4 }, { mode: "listen", min: 5, max: 5 }, { mode: "listen", min: 6 },
    { mode: "sentence", min: 2, max: 2 }, { mode: "sentence", min: 3, max: 3 }, { mode: "sentence", min: 4, max: 5 },
  ],
  ({ mode, min, max }) =>
    mode === "letter"
      ? { en: "Finds a letter on the keyboard", ru: "Находит букву на клавиатуре", uz: "Klaviaturada harfni topadi" }
      : mode === "word"
        ? { en: `Types a ${range(min, max)} letter word it can see`, ru: `Печатает слово из ${range(min, max)} букв, глядя на него`, uz: `Koʻrib turgan ${range(min, max)} harfli soʻzni yozadi` }
        : mode === "listen"
          ? { en: `Types a ${range(min, max)} letter word it hears`, ru: `Печатает услышанное слово из ${range(min, max)} букв`, uz: `Eshitgan ${range(min, max)} harfli soʻzini yozadi` }
          : { en: `Types a ${range(min, max)} word sentence it hears`, ru: `Печатает услышанное предложение из ${range(min, max)} слов`, uz: `Eshitgan ${range(min, max)} soʻzli gapni yozadi` },
);

const count = game<CountSettings>(
  "count",
  [
    { lo: 1, hi: 5, by: 1, options: 2 }, { lo: 1, hi: 5, by: 1, options: 3 }, { lo: 1, hi: 7, by: 1, options: 3 },
    { lo: 1, hi: 10, by: 1, options: 3 }, { lo: 5, hi: 10, by: 1, options: 4 }, { lo: 10, hi: 15, by: 1, options: 4 },
    { lo: 4, hi: 20, by: 2, options: 4 }, { lo: 10, hi: 30, by: 2, options: 4 }, { lo: 10, hi: 50, by: 5, options: 4 },
    { lo: 20, hi: 100, by: 5, options: 4 }, { lo: 20, hi: 100, by: 10, options: 4 }, { lo: 20, hi: 100, by: "mixed", options: 4 },
  ],
  ({ lo, hi, by, options: k }) => {
    const pick = { en: `, choosing from ${k}`, ru: `, выбирая из ${k}`, uz: `, ${k} ta javobdan tanlab` };
    const base: L10n =
      by === 1
        ? { en: `Counts ${lo}–${hi} things`, ru: `Считает от ${lo} до ${hi} предметов`, uz: `${lo} dan ${hi} gacha narsani sanaydi` }
        : by === "mixed"
          ? { en: `Counts groups of 10, 5 and 2 up to ${hi}`, ru: `Считает группами по 10, 5 и 2 до ${hi}`, uz: `${hi} gacha 10, 5 va 2 talik guruhlarni sanaydi` }
          : { en: `Counts by ${by}s up to ${hi}`, ru: `Считает по ${by} до ${hi}`, uz: `${hi} gacha ${by} tadan sanaydi` };
    return { en: base.en + pick.en, ru: base.ru + pick.ru, uz: base.uz + pick.uz };
  },
);

// ---------------------------------------------------------------- §6.1 Attention (new games)
const oddOneOut = game<OddOneOutSettings>(
  "odd_one_out",
  [
    { options: 4, mode: "items" }, { options: 5, mode: "items" }, { options: 6, mode: "items" },
    { options: 6, mode: "shapes" }, { options: 8, mode: "shapes" }, { options: 9, mode: "colors" },
    { options: 12, mode: "similar" }, { options: 16, mode: "turn" }, { options: 20, mode: "turn" },
    { options: 25, mode: "fine" }, { options: 30, mode: "fine" }, { options: 36, mode: "fine" },
  ],
  ({ options: n, mode }) =>
    ({
      items: { en: `Spots the one different picture among ${n}`, ru: `Находит лишнюю картинку среди ${n}`, uz: `${n} ta rasm ichidan ortiqchasini topadi` },
      similar: { en: `Spots the one different picture among ${n} similar ones`, ru: `Находит лишнюю картинку среди ${n} похожих`, uz: `${n} ta oʻxshash rasm ichidan ortiqchasini topadi` },
      shapes: { en: `Spots the different shape among ${n}`, ru: `Находит лишнюю фигуру среди ${n}`, uz: `${n} ta shakl ichidan boshqacha shaklni topadi` },
      colors: { en: `Spots the shape of another colour among ${n}`, ru: `Находит фигуру другого цвета среди ${n}`, uz: `${n} ta shakl ichidan boshqa rangdagisini topadi` },
      turn: { en: `Spots the shape turned another way among ${n}`, ru: `Находит иначе повёрнутую фигуру среди ${n}`, uz: `${n} ta shakl ichidan boshqacha burilganini topadi` },
      fine: { en: `Spots a small turn or shade among ${n} shapes`, ru: `Замечает небольшой поворот или оттенок среди ${n} фигур`, uz: `${n} ta shakl ichidan kichik burilish yoki tusni sezadi` },
    })[mode],
);

const SPEED_WORD = {
  1: { en: "slowly", ru: "медленно", uz: "sekin" },
  2: { en: "steadily", ru: "спокойно", uz: "bir maromda" },
  3: { en: "quickly", ru: "быстро", uz: "tez" },
  4: { en: "fast", ru: "очень быстро", uz: "juda tez" },
} as const;
const trackFish = game<TrackFishSettings>(
  "track_fish",
  (
    [
      [3, 1, 1, 3], [4, 1, 1, 3], [4, 2, 1, 4],
      [5, 2, 2, 4], [6, 2, 2, 5], [6, 3, 2, 5],
      [7, 3, 3, 5], [8, 3, 3, 6], [8, 4, 3, 6],
      [9, 4, 4, 6], [10, 4, 4, 7], [10, 4, 4, 9],
    ] as const
  ).map(([fish, glow, speed, moves]) => ({ fish, glow, speed, moves })),
  ({ fish: n, glow: k, speed, moves }) => {
    const long = moves >= 8;
    return {
      en: `Follows ${k} of ${n} fish swimming ${SPEED_WORD[speed].en}${long ? ", for a long swim" : ""}`,
      ru: `Следит за ${k} из ${n} рыбок, которые плавают ${SPEED_WORD[speed].ru}${long ? ", и долго" : ""}`,
      uz: `${SPEED_WORD[speed].uz} suzayotgan ${n} ta baliqdan ${k} tasini ${long ? "uzoq vaqt " : ""}kuzatadi`,
    };
  },
);

const whichWay = game<WhichWaySettings>(
  "which_way",
  [
    { dirs: 4, flank: 0 }, { dirs: 4, flank: 1, mode: "same" }, { dirs: 4, flank: 2, mode: "same" },
    { dirs: 2, flank: 2, mode: "mixed" }, { dirs: 4, flank: 2, mode: "mixed" }, { dirs: 4, flank: 2, mode: "against" },
    { dirs: 4, flank: 3, mode: "against" }, { dirs: 2, flank: 2, mode: "mixed", blue: 0.3 }, { dirs: 4, flank: 2, mode: "mixed", blue: 0.3 },
    { dirs: 2, flank: 2, mode: "against", blue: 0.5 }, { dirs: 4, flank: 2, mode: "against", blue: 0.5 }, { dirs: 4, flank: 3, mode: "against", blue: 0.5 },
  ],
  ({ dirs, flank, mode = "same", blue }) => {
    if (!flank) return { en: "Shows which way an arrow points", ru: "Показывает, куда смотрит стрелка", uz: "Strelka qayerga qarayotganini koʻrsatadi" };
    const around = {
      same: { en: "pointing the same way", ru: "смотрящих туда же", uz: "ular ham shu tomonga qaraydi" },
      mixed: { en: "pointing any way", ru: "смотрящих куда угодно", uz: "ular istalgan tomonga qaraydi" },
      against: { en: "pointing other ways", ru: "смотрящих в другую сторону", uz: "ular boshqa tomonga qaraydi" },
    }[mode];
    const b = blue ? { en: "; a blue arrow means the other way", ru: "; синяя стрелка — в другую сторону", uz: "; koʻk strelka — teskari tomon" } : { en: "", ru: "", uz: "" };
    return {
      en: `Shows which way the middle arrow points among ${flank * 2} others ${around.en}, choosing from ${dirs} ways${b.en}`,
      ru: `Показывает, куда смотрит средняя стрелка среди ${flank * 2} других, ${around.ru}, выбирая из ${dirs} направлений${b.ru}`,
      uz: `Atrofida ${flank * 2} ta strelka boʻlsa ham (${around.uz}) oʻrtadagi strelka qayerga qarayotganini ${dirs} ta yoʻnalishdan tanlab koʻrsatadi${b.uz}`,
    };
  },
);

// ---------------------------------------------------------------- §6.2 Memory (new games)
const cardPairs = game<CardPairsSettings>(
  "card_pairs",
  [
    { pairs: 2 }, { pairs: 3 }, { pairs: 4 },
    { pairs: 4, similar: true }, { pairs: 5 }, { pairs: 6 },
    { pairs: 6, similar: true }, { pairs: 7 }, { pairs: 8 },
    { pairs: 9 }, { pairs: 10 }, { pairs: 12 },
  ],
  ({ pairs: p, similar }) => ({
    en: `Finds ${p} pairs among ${p * 2} cards${similar ? " of similar food" : ""}`,
    ru: `Находит ${p} ${pl(p, "пару", "пары", "пар")} среди ${p * 2} карточек${similar ? " с похожей едой" : ""}`,
    uz: `${p * 2} ta karta ichidan ${p} ta juftni topadi${similar ? " (oʻxshash taomlar)" : ""}`,
  }),
);

const shoppingList = game<ShoppingSettings>(
  "shopping_list",
  [
    { items: 2, shelf: 4, show: true, replay: true }, { items: 2, shelf: 6, show: true, replay: true }, { items: 3, shelf: 6, show: true, replay: true },
    { items: 3, shelf: 6, show: false, replay: true }, { items: 4, shelf: 8, show: true, replay: true }, { items: 4, shelf: 8, show: false, replay: true },
    { items: 5, shelf: 9, show: false, replay: true }, { items: 5, shelf: 10, show: false, replay: false }, { items: 6, shelf: 10, show: false, replay: false, wait: 5 },
    { items: 6, shelf: 12, show: false, replay: false, wait: 10 }, { items: 7, shelf: 12, show: false, replay: false, wait: 15 }, { items: 8, shelf: 12, show: false, replay: false, wait: 20 },
  ],
  ({ items: n, shelf, show, replay, wait }) => ({
    en: `Remembers a list of ${n} things ${show ? "seen and heard" : "only heard"}${replay ? "" : ", heard once"}${wait ? `, after a ${wait} second pause` : ""}, out of ${shelf}`,
    ru: `Запоминает список из ${n} ${pl(n, "вещи", "вещей", "вещей")}, ${show ? "увидев и услышав его" : "только услышав его"}${replay ? "" : " один раз"}${wait ? `, после паузы в ${wait} секунд` : ""}, выбирая из ${shelf}`,
    uz: `${n} ta narsali roʻyxatni ${show ? "koʻrib va eshitib" : "faqat eshitib"}${replay ? "" : ", qayta tinglamasdan"}${wait ? `, ${wait} soniya kutib` : ""} eslab qoladi, ${shelf} ta narsa ichidan`,
  }),
);

const nBack = game<NBackSettings>(
  "n_back",
  [
    { n: 1, items: 6 }, { n: 1, items: 8 }, { n: 1, items: 10 },
    { n: 2, items: 6 }, { n: 2, items: 8 }, { n: 2, items: 10 },
    { n: 3, items: 8 }, { n: 3, items: 10 }, { n: 1, items: 8, place: true },
    { n: 2, items: 8, place: true }, { n: 2, items: 10, place: true }, { n: 3, items: 10, place: true },
  ],
  ({ n, items, place }) => ({
    en: `Tells if a picture is the same as ${n === 1 ? "the one before" : `${n} pictures back`}${place ? ", and in the same place" : ""}, in a row of ${items}`,
    ru: `Понимает, та же ли картинка, что ${n === 1 ? "перед ней" : `${n} картинки назад`}${place ? ", и на том же ли месте" : ""}, в ряду из ${items}`,
    uz: `${items} ta rasmli qatorda rasm ${n === 1 ? "oldingisi" : `${n} ta oldingisi`} bilan bir xilmi${place ? " va bir joydami" : ""}, ajratadi`,
  }),
);

const pairsRecall = game<PairsRecallSettings>(
  "pairs_recall",
  (
    [
      [2, 2, 2], [3, 3, 2], [3, 3, 3],
      [4, 3, 3], [4, 4, 4], [5, 4, 4],
      [5, 5, 4], [6, 5, 4], [6, 6, 5],
      [7, 6, 5], [8, 6, 5], [8, 8, 6],
    ] as const
  ).map(([pairs, options, ask]) => ({ pairs, options, ask })),
  ({ pairs: p, options: o, ask: a }) => ({
    en: `Remembers what ${p} children ordered and answers ${a} questions, choosing from ${o}`,
    ru: `Запоминает, что заказали ${p} ${pl(p, "ребёнок", "ребёнка", "детей")}, и отвечает на ${a} ${pl(a, "вопрос", "вопроса", "вопросов")}, выбирая из ${o}`,
    uz: `${p} ta bola nima buyurtma qilganini eslab qoladi va ${a} ta savolga ${o} ta javobdan tanlab javob beradi`,
  }),
);

// ---------------------------------------------------------------- §6.3 Flexibility (new games)
const switchSort = game<SwitchSortSettings>(
  "switch_sort",
  (
    [
      [8, 6, true, 2], [10, 5, true, 2], [12, 4, true, 2],
      [12, 4, false, 2], [12, 3, false, 2], [12, 3, false, 3],
      [12, 2, false, 2], [12, 2, false, 3], [14, 0, false, 2],
      [12, 0, false, 3], [14, 0, false, 3], [16, 0, false, 3],
    ] as const
  ).map(([cards, every, said, boxes]) => ({ cards, every, said, boxes })),
  ({ cards: n, every, said, boxes }) => {
    const when = every
      ? { en: `the rule changes every ${every} cards`, ru: `правило меняется каждые ${every} ${pl(every, "карточку", "карточки", "карточек")}`, uz: `qoida har ${every} ta kartadan keyin almashadi` }
      : { en: "the rule can change at any card", ru: "правило может смениться на любой карточке", uz: "qoida istalgan kartada almashishi mumkin" };
    const say = said ? { en: ", said aloud", ru: ", и это говорится вслух", uz: ", bu ovoz chiqarib aytiladi" } : { en: ", shown only by the frame", ru: ", это видно только по рамке", uz: ", buni faqat ramka koʻrsatadi" };
    return {
      en: `Sorts ${n} cards by colour or by shape into ${boxes} boxes; ${when.en}${say.en}`,
      ru: `Раскладывает ${n} карточек по цвету или по форме в ${boxes} коробки; ${when.ru}${say.ru}`,
      uz: `${n} ta kartani rangi yoki shakli boʻyicha ${boxes} ta qutiga ajratadi; ${when.uz}${say.uz}`,
    };
  },
);

const opposite = game<OppositeSettings>(
  "opposite",
  [
    { mode: "pictures", options: 2 }, { mode: "pictures", options: 3 }, { mode: "glyphs", options: 2 },
    { mode: "mixed", options: 3 }, { mode: "mixed", options: 4 }, { mode: "close", options: 3 },
    { mode: "close", options: 4 }, { mode: "close", options: 5 }, { mode: "close", options: 6 },
    { mode: "stroop", options: 3 }, { mode: "stroop", options: 4 }, { mode: "stroop", options: 6 },
  ],
  ({ mode, options: n }) =>
    ({
      pictures: { en: `Picks the opposite picture (sun and moon) out of ${n}`, ru: `Выбирает противоположную картинку (солнце и луна) из ${n}`, uz: `${n} ta rasm ichidan qarama-qarshisini tanlaydi (quyosh va oy)` },
      glyphs: { en: `Picks the opposite shape (big and small, up and down) out of ${n}`, ru: `Выбирает противоположную фигуру (большая и маленькая, вверх и вниз) из ${n}`, uz: `${n} ta shakl ichidan qarama-qarshisini tanlaydi (katta va kichik, yuqori va past)` },
      mixed: { en: `Picks the opposite of a picture or a shape out of ${n}`, ru: `Выбирает противоположное к картинке или фигуре из ${n}`, uz: `${n} ta javob ichidan rasm yoki shaklning qarama-qarshisini tanlaydi` },
      close: { en: `Picks the opposite out of ${n} look-alikes`, ru: `Выбирает противоположное из ${n} похожих`, uz: `${n} ta oʻxshash narsa ichidan qarama-qarshisini tanlaydi` },
      stroop: { en: `Reads a colour word written in another colour and picks the ink colour out of ${n}`, ru: `Читает название цвета, написанное другим цветом, и выбирает цвет букв из ${n}`, uz: `Boshqa rangda yozilgan rang nomini oʻqiydi va ${n} ta rangdan harflar rangini tanlaydi` },
    })[mode],
  // The colour words must be read: offered once the child's Language tier 3 is open (spec §6.3).
  ({ mode }) => (mode === "stroop" ? { area: "literacy", tier: 3 } : undefined),
);

const RULE_NAMES = {
  2: { en: "colour or shape", ru: "цвет или форма", uz: "rang yoki shakl" },
  3: { en: "colour, shape or number", ru: "цвет, форма или количество", uz: "rang, shakl yoki son" },
  4: { en: "colour, shape, number or size", ru: "цвет, форма, количество или размер", uz: "rang, shakl, son yoki oʻlcham" },
} as const;
const secretRule = game<SecretRuleSettings>(
  "secret_rule",
  (
    [
      [2, 10, 12], [2, 8, 12], [2, 6, 12],
      [3, 8, 12], [3, 6, 12], [3, 5, 15],
      [3, 4, 12], [4, 6, 12], [4, 6, 16],
      [4, 5, 16], [4, 4, 16], [4, 4, 20],
    ] as const
  ).map(([rules, every, cards]) => ({ rules, every, cards })),
  ({ rules, every, cards: n }) => ({
    en: `Finds a hidden sorting rule (${RULE_NAMES[rules].en}) that changes after ${every} right cards, in ${n} cards`,
    ru: `Находит тайное правило (${RULE_NAMES[rules].ru}), которое меняется после ${every} верных карточек, за ${n} карточек`,
    uz: `${n} ta kartada yashirin qoidani (${RULE_NAMES[rules].uz}) topadi; qoida ${every} ta toʻgʻri kartadan keyin almashadi`,
  }),
);

// ---------------------------------------------------------------- §6.4 Reasoning (new games)
const nextPattern = game<NextPatternSettings>(
  "next_pattern",
  [
    { mode: "ab", by: "color", options: 2 }, { mode: "ab", by: "shape", options: 2 }, { mode: "ab", by: "both", options: 3 },
    { mode: "aab", by: "both", options: 3 }, { mode: "abc", by: "both", options: 3 }, { mode: "grow", options: 4 },
    { mode: "turn", options: 4 }, { mode: "grid", size: 3, rules: 1, options: 4 }, { mode: "grid", size: 2, rules: 2, options: 4 },
    { mode: "grid", size: 3, rules: 2, options: 4 }, { mode: "grid", size: 3, rules: 2, options: 5 }, { mode: "grid", size: 3, rules: 2, options: 6 },
  ],
  ({ mode, by, size, rules, options: n }) => {
    if (mode === "grid")
      return rules === 1
        ? { en: `Finishes a ${size}×${size} grid where each row has one shape, out of ${n}`, ru: `Заканчивает сетку ${size}×${size}, где в каждом ряду своя фигура, из ${n}`, uz: `Har qatorida bitta shakl boʻlgan ${size}×${size} toʻrni ${n} ta javobdan tanlab tugatadi` }
        : { en: `Finishes a ${size}×${size} grid with two rules (rows and columns), out of ${n} near misses`, ru: `Заканчивает сетку ${size}×${size} с двумя правилами (ряды и столбцы) из ${n} похожих`, uz: `Ikki qoidali (qator va ustun) ${size}×${size} toʻrni ${n} ta oʻxshash javobdan tanlab tugatadi` };
    const what = { color: { en: "colours", ru: "цвета", uz: "ranglar" }, shape: { en: "shapes", ru: "фигуры", uz: "shakllar" }, both: { en: "shapes and colours", ru: "фигуры и цвета", uz: "shakl va ranglar" } }[by ?? "both"];
    return (
      {
        ab: { en: `Finishes an ABAB row of ${what.en}, out of ${n}`, ru: `Продолжает ряд АБАБ (${what.ru}), выбирая из ${n}`, uz: `ABAB qatorini (${what.uz}) ${n} ta javobdan tanlab davom ettiradi` },
        aab: { en: `Finishes an AAB row of shapes and colours, out of ${n}`, ru: `Продолжает ряд ААБ из фигур и цветов, выбирая из ${n}`, uz: `AAB qatorini (shakl va ranglar) ${n} ta javobdan tanlab davom ettiradi` },
        abc: { en: `Finishes an ABC row of shapes and colours, out of ${n}`, ru: `Продолжает ряд АБВ из фигур и цветов, выбирая из ${n}`, uz: `ABC qatorini (shakl va ranglar) ${n} ta javobdan tanlab davom ettiradi` },
        grow: { en: `Finishes a row that grows small, middle, big, out of ${n}`, ru: `Продолжает ряд «маленький, средний, большой», выбирая из ${n}`, uz: `«Kichik, oʻrta, katta» qatorini ${n} ta javobdan tanlab davom ettiradi` },
        turn: { en: `Finishes a row of a shape turning a quarter each time, out of ${n}`, ru: `Продолжает ряд фигуры, которая каждый раз поворачивается на четверть, выбирая из ${n}`, uz: `Har safar chorak burilayotgan shakl qatorini ${n} ta javobdan tanlab davom ettiradi` },
      } as const
    )[mode];
  },
);

const balance = game<BalanceSettings>(
  "balance",
  [
    { mode: "most", items: 2, ask: "heavy", options: 2 }, { mode: "most", items: 2, ask: "light", options: 2 }, { mode: "most", items: 3, ask: "heavy", options: 3 },
    { mode: "most", items: 3, ask: "light", options: 3 }, { mode: "most", items: 3, ask: "heavy", shuffle: true, options: 3 }, { mode: "count", level: 1, options: 3 },
    { mode: "most", items: 4, ask: "heavy", options: 4 }, { mode: "most", items: 4, ask: "light", shuffle: true, options: 4 }, { mode: "count", level: 1, options: 4 },
    { mode: "most", items: 4, ask: "heavy", shuffle: true, options: 4 }, { mode: "count", level: 2, options: 4 }, { mode: "count", level: 3, options: 5 },
  ],
  ({ mode, items: n = 2, ask, shuffle, level, options: o }) => {
    if (mode === "count")
      return (
        {
          1: { en: `Works out how many circles weigh as much as some squares, from one scale (${o} answers)`, ru: `По одним весам находит, сколько кружков весят как несколько квадратов (${o} ответа)`, uz: `Bitta tarozidan nechta doira bir necha kvadratga teng ogʻirlikda ekanini topadi (${o} ta javob)` },
          2: { en: `Works out how many circles weigh as much as a square, from two scales one after the other`, ru: `По двум весам по цепочке находит, сколько кружков весят как квадрат`, uz: `Ikki tarozidan ketma-ket hisoblab, nechta doira bitta kvadratga teng ekanini topadi` },
          3: { en: `Works out how many circles weigh as much as a square, from two scales with mixed shapes`, ru: `По двум весам с разными фигурами находит, сколько кружков весят как квадрат`, uz: `Aralash shakllar turgan ikki tarozidan nechta doira bitta kvadratga teng ekanini topadi` },
        } as const
      )[level ?? 1];
    if (n === 2) return ask === "heavy" ? { en: "Shows the heavier side of a tilted scale", ru: "Показывает, какая сторона весов тяжелее", uz: "Tarozining ogʻirroq tomonini koʻrsatadi" } : { en: "Shows the lighter side of a tilted scale", ru: "Показывает, какая сторона весов легче", uz: "Tarozining yengilroq tomonini koʻrsatadi" };
    const most = ask === "heavy" ? { en: "heaviest", ru: "самую тяжёлую", uz: "eng ogʻirini" } : { en: "lightest", ru: "самую лёгкую", uz: "eng yengilini" };
    const mixed = shuffle ? { en: ", the scales mixed up", ru: ", весы вперемешку", uz: ", tarozilar aralash" } : { en: "", ru: "", uz: "" };
    return {
      en: `Finds the ${most.en} of ${n} things from ${n - 1} scales${mixed.en}`,
      ru: `Находит ${most.ru} из ${n} вещей по ${n - 1} весам${mixed.ru}`,
      uz: `${n - 1} ta tarozidan ${n} ta narsaning ${most.uz} topadi${mixed.uz}`,
    };
  },
);

const pipes = game<PipesSettings>(
  "pipes",
  (
    [
      [3, 1, 1], [4, 2, 1], [3, 3, 1],
      [4, 3, 1], [4, 4, 1], [5, 4, 1],
      [5, 5, 1], [6, 5, 1], [6, 6, 1],
      [6, 6, 2], [7, 6, 2], [7, 7, 2],
    ] as const
  ).map(([cols, rows, flowers]) => ({ cols, rows, flowers })),
  ({ cols, rows, flowers }) =>
    rows === 1
      ? { en: `Turns ${cols} pipes in a line so water reaches the flower`, ru: `Поворачивает ${cols} трубы в ряд, чтобы вода дошла до цветка`, uz: `Suv gulga yetishi uchun qatordagi ${cols} ta quvurni buradi` }
      : {
          en: `Turns pipes on a ${cols}×${rows} grid so water reaches ${flowers === 2 ? "two flowers" : "the flower"}`,
          ru: `Поворачивает трубы на поле ${cols}×${rows}, чтобы вода дошла до ${flowers === 2 ? "двух цветков" : "цветка"}`,
          uz: `Suv ${flowers === 2 ? "ikkita gulga" : "gulga"} yetishi uchun ${cols}×${rows} maydondagi quvurlarni buradi`,
        },
);

const logicHouses = game<LogicHousesSettings>(
  "logic_houses",
  (
    [
      [2, 1, 1], [3, 2, 1], [3, 2, 0],
      [4, 3, 1], [4, 3, 0], [4, 4, 1],
      [4, 4, 0], [5, 4, 2], [5, 5, 1],
      [5, 5, 0], [5, 6, 1], [5, 6, 0],
    ] as const
  ).map(([houses, clues, at]) => ({ houses, clues, at })),
  ({ houses: n, clues: k, at }) => {
    const none = at === 0 ? { en: ", none of them naming a house", ru: ", ни одна не называет дом", uz: ", hech biri uyni aytmaydi" } : { en: "", ru: "", uz: "" };
    return {
      en: `Puts ${n} animals in their houses from ${k} picture ${k === 1 ? "clue" : "clues"}${none.en}`,
      ru: `Расселяет ${n} ${pl(n, "зверя", "зверей", "зверей")} по домам по ${k} ${pl(k, "подсказке", "подсказкам", "подсказкам")}-картинкам${none.ru}`,
      uz: `${k} ta rasmli ishoradan ${n} ta hayvonni uylariga joylaydi${none.uz}`,
    };
  },
);

const shadowMatch = game<ShadowSettings>(
  "shadow_match",
  [
    { options: 2, pool: "any", turn: "none" }, { options: 3, pool: "any", turn: "none" }, { options: 3, pool: "any", turn: "same" },
    { options: 3, pool: "similar", turn: "same" }, { options: 4, pool: "any", turn: "other" }, { options: 4, pool: "similar", turn: "other" },
    { options: 3, pool: "mirror", turn: "same" }, { options: 4, pool: "mirror", turn: "same" }, { options: 4, pool: "mirror", turn: "other" },
    { options: 4, pool: "mirror", turn: "other", flip: true }, { options: 5, pool: "mirror", turn: "other", flip: true }, { options: 6, pool: "mirror", turn: "other", flip: true },
  ],
  ({ options: n, pool, turn, flip }) => {
    const others = { any: { en: "other shapes", ru: "других фигур", uz: "boshqa shakllar" }, similar: { en: "look-alike shapes", ru: "похожих фигур", uz: "oʻxshash shakllar" }, mirror: { en: "mirror images", ru: "зеркальных отражений", uz: "koʻzgudagi aksi" } }[pool];
    const t = { none: { en: "", ru: "", uz: "" }, same: { en: ", turned the same way", ru: ", повёрнутую так же", uz: ", bir xil burilgan" }, other: { en: ", turned another way", ru: ", повёрнутую по-другому", uz: ", boshqacha burilgan" } }[turn];
    const f = flip ? { en: " and flipped", ru: " и перевёрнутую", uz: " va agʻdarilgan" } : { en: "", ru: "", uz: "" };
    return {
      en: `Matches a shape to its shadow${t.en}${f.en}, among ${n - 1} ${others.en}`,
      ru: `Находит фигуру по её тени${t.ru}${f.ru}, среди ${n - 1} ${others.ru}`,
      uz: `Shaklni soyasiga moslaydi${t.uz}${f.uz}; ${n - 1} ta ${others.uz} orasidan`,
    };
  },
);

// ---------------------------------------------------------------- §6.5 Math
const moreLess = game<MoreLessSettings>(
  "more_less",
  [
    { min: 1, max: 5, diff: [3, 4], ask: "more" }, { min: 1, max: 6, diff: [2, 3], ask: "more" }, { min: 1, max: 8, diff: [2, 3], ask: "both" },
    { min: 3, max: 10, diff: [2, 2], ask: "both" }, { min: 4, max: 12, diff: [2, 3], mixed: true, ask: "more" }, { min: 5, max: 12, diff: [1, 2], ask: "both" },
    { min: 6, max: 15, diff: [2, 2], mixed: true, ask: "both" }, { min: 8, max: 16, diff: [2, 3], cover: 3, ask: "both" }, { min: 8, max: 16, diff: [1, 2], mixed: true, cover: 3, ask: "both" },
    { min: 10, max: 18, diff: [2, 2], mixed: true, cover: 2, ask: "both" }, { min: 12, max: 20, diff: [2, 2], mixed: true, cover: 2, ask: "both" }, { min: 16, max: 20, diff: [1, 2], mixed: true, cover: 2, ask: "both" },
  ],
  ({ min, max, diff, mixed, cover, ask }) => {
    const which = { more: { en: "more", ru: "больше", uz: "koʻproq" }, less: { en: "fewer", ru: "меньше", uz: "kamroq" }, both: { en: "more or fewer", ru: "больше или меньше", uz: "koʻproq yoki kamroq" } }[ask];
    const by = diff[0] === diff[1] ? `${diff[0]}` : `${diff[0]}–${diff[1]}`;
    return {
      en: `Sees which group of ${min}–${max} dots has ${which.en}, ${by} apart${mixed ? ", dots of mixed sizes" : ""}${cover ? `, seen for ${cover} s` : ""}`,
      ru: `Видит, где ${which.ru} точек (${min}–${max}, разница ${by})${mixed ? ", точки разного размера" : ""}${cover ? `, видит их ${cover} с` : ""}`,
      uz: `${min}–${max} ta nuqtadan qaysi guruhda ${which.uz} ekanini koʻradi (farqi ${by})${mixed ? ", nuqtalar har xil kattalikda" : ""}${cover ? `, ${cover} soniya koʻrib` : ""}`,
    };
  },
);

const numberLine = game<NumberLineSettings>(
  "number_line",
  [
    { max: 10, tick: 1, labels: 5, options: 5 }, { max: 10, tick: 1, labels: 0, options: 5 }, { max: 20, tick: 1, labels: 5, options: 5 },
    { max: 20, tick: 1, labels: 10, options: 5 }, { max: 50, tick: 5, labels: 25, options: 4 }, { max: 50, tick: 5, labels: 0, options: 5 },
    { max: 100, tick: 10, labels: 50, options: 5 }, { max: 100, tick: 10, labels: 0, options: 5 }, { max: 100, tick: 5, labels: 50, options: 4 },
    { max: 1000, tick: 100, labels: 500, options: 5 }, { max: 1000, tick: 50, labels: 0, options: 4 }, { max: 12, tick: 1, labels: 4, options: 4, frac: 4 },
  ],
  ({ max, tick, labels, options: n, frac }) =>
    frac
      ? { en: `Places halves and quarters on a line from 0 to ${max / 4}, among ${n} marks`, ru: `Находит место половин и четвертей на прямой от 0 до ${max / 4}, среди ${n} отметок`, uz: `0 dan ${max / 4} gacha chiziqda yarim va chorak oʻrnini ${n} ta belgi orasidan topadi` }
      : {
          en: `Places a number on a line from 0 to ${max} (marks every ${tick}${labels ? `, numbers every ${labels}` : ", only the ends numbered"}), among ${n}`,
          ru: `Находит место числа на прямой от 0 до ${max} (отметки через ${tick}${labels ? `, числа через ${labels}` : ", подписаны только концы"}), среди ${n}`,
          uz: `0 dan ${max} gacha chiziqda sonning oʻrnini ${n} ta belgidan topadi (belgi har ${tick} da${labels ? `, son har ${labels} da` : ", son faqat uchlarida"})`,
        },
);

const bazaar = game<BazaarSettings>(
  "bazaar",
  [
    { mode: "note", top: 5000, options: 2 }, { mode: "note", top: 10000, options: 3 }, { mode: "note", top: 20000, options: 4 },
    { mode: "pay", top: 10000, notes: 2, wallet: 4 }, { mode: "pay", top: 10000, notes: 2, wallet: 5 }, { mode: "pay", top: 20000, notes: 3, wallet: 5 },
    { mode: "pay", top: 50000, notes: 3, wallet: 6 }, { mode: "change", top: 10000, paid: 10000, options: 3 }, { mode: "pay", top: 100000, notes: 4, wallet: 7 },
    { mode: "change", top: 20000, paid: 20000, options: 4, half: true }, { mode: "pay", top: 100000, notes: 5, wallet: 8 }, { mode: "change", top: 50000, paid: 50000, options: 4, half: true },
  ],
  ({ mode, top, options: n, notes, wallet, paid }) => {
    const som = (v: number) => v.toLocaleString("en").replace(/,/g, " ");
    if (mode === "note") return { en: `Pays with one note, choosing among ${n} notes up to ${som(top)} so'm`, ru: `Платит одной купюрой, выбирая из ${n} купюр до ${som(top)} сумов`, uz: `${som(top)} soʻmgacha ${n} ta kupyura orasidan bittasi bilan toʻlaydi` };
    if (mode === "pay") return { en: `Makes a price from ${notes} of ${wallet} notes (up to ${som(top)} so'm)`, ru: `Набирает цену из ${notes} купюр из ${wallet} (до ${som(top)} сумов)`, uz: `${wallet} ta kupyura orasidan ${notes} tasi bilan narxni yigʻadi (${som(top)} soʻmgacha)` };
    return { en: `Picks the change from ${som(paid!)} so'm, among ${n}`, ru: `Находит сдачу с ${som(paid!)} сумов, среди ${n}`, uz: `${som(paid!)} soʻmdan qaytimni ${n} ta javobdan topadi` };
  },
);

const missingNumber = game<MissingNumberSettings>(
  "missing_number",
  [
    { form: "add", max: 5, options: 2, pics: true }, { form: "add", max: 5, options: 3, pics: true }, { form: "add", max: 10, options: 3, pics: true },
    { form: "add", max: 10, options: 3 }, { form: "sub", max: 10, options: 4 }, { form: "addsub", max: 20, options: 4 },
    { form: "addsub", max: 100, options: 4 }, { form: "mul", max: 5, options: 4 }, { form: "muldiv", max: 10, options: 4 },
    { form: "two", max: 50, options: 4 }, { form: "muladd", max: 10, options: 4 }, { form: "mulsub", max: 12, options: 4 },
  ],
  ({ form, max, options: n, pics }) => {
    const what = {
      add: { en: "an addition", ru: "сложении", uz: "qoʻshishda" },
      sub: { en: "a subtraction", ru: "вычитании", uz: "ayirishda" },
      addsub: { en: "an addition or subtraction", ru: "сложении или вычитании", uz: "qoʻshish yoki ayirishda" },
      mul: { en: "a times sum", ru: "умножении", uz: "koʻpaytirishda" },
      muldiv: { en: "a times or sharing sum", ru: "умножении или делении", uz: "koʻpaytirish yoki boʻlishda" },
      two: { en: "a sum with two steps (+ and −)", ru: "примере в два действия (+ и −)", uz: "ikki amalli misolda (+ va −)" },
      muladd: { en: "a sum with × and +", ru: "примере с × и +", uz: "× va + bor misolda" },
      mulsub: { en: "a sum with × and −", ru: "примере с × и −", uz: "× va − bor misolda" },
    }[form];
    return {
      en: `Finds the missing number in ${what.en} up to ${max}${pics ? ", with pictures" : ""}, among ${n}`,
      ru: `Находит пропущенное число в ${what.ru} до ${max}${pics ? ", с картинками" : ""}, среди ${n}`,
      uz: `${max} gacha ${what.uz} tushib qolgan sonni topadi${pics ? ", rasmlar bilan" : ""}, ${n} tadan`,
    };
  },
);

// ---------------------------------------------------------------- §6.6 Language
const rhyme = game<RhymeSettings>(
  "rhyme",
  [
    { mode: "rhyme", options: 2 }, { mode: "rhyme", options: 3 }, { mode: "rhyme", options: 3, near: true },
    { mode: "rhyme", options: 4 }, { mode: "rhyme", options: 4, near: true }, { mode: "rhyme", options: 5, near: true },
    { mode: "rhyme", options: 6 }, { mode: "rhyme", options: 6, near: true }, { mode: "drop", options: 2 },
    { mode: "drop", options: 3 }, { mode: "drop", options: 4 }, { mode: "drop", options: 4, near: true },
  ],
  ({ mode, options: n, near }) =>
    mode === "drop"
      ? {
          en: `Says a word without one sound and finds it among ${n} pictures${near ? ", some sounding alike" : ""}`,
          ru: `Убирает звук из слова и находит новое слово среди ${n} картинок${near ? ", некоторые звучат похоже" : ""}`,
          uz: `Soʻzdan bitta tovushni olib tashlab, yangi soʻzni ${n} ta rasm orasidan topadi${near ? ", baʼzilari oʻxshash eshitiladi" : ""}`,
        }
      : {
          en: `Finds the word that rhymes among ${n} pictures${near ? ", some starting with the same sound" : ""}`,
          ru: `Находит рифму среди ${n} картинок${near ? ", некоторые начинаются с того же звука" : ""}`,
          uz: `${n} ta rasm orasidan qofiyadosh soʻzni topadi${near ? ", baʼzilari bir xil tovush bilan boshlanadi" : ""}`,
        },
);

const wordBuilder = game<WordBuilderSettings>(
  "word_builder",
  [
    { min: 3, max: 3, picture: true, extra: 0 }, { min: 3, max: 3, picture: true, extra: 2 }, { min: 3, max: 4, picture: true, extra: 2 },
    { min: 4, max: 4, picture: true, extra: 2 }, { min: 4, max: 5, picture: true, extra: 3 }, { min: 5, max: 5, picture: true, extra: 3 },
    { min: 5, max: 6, picture: true, extra: 4 }, { min: 5, max: 6, picture: false, extra: 2 }, { min: 6, max: 6, picture: false, extra: 3 },
    { min: 6, max: 7, picture: false, extra: 2 }, { min: 6, max: 7, picture: false, extra: 4 }, { min: 7, max: 7, picture: false, extra: 0 },
  ],
  ({ min, max, picture, extra }) => ({
    en: `Builds a word of ${range(min, max)} letters ${picture ? "with a picture" : "only heard"}${extra ? `, with ${extra} extra letters` : ""}`,
    ru: `Собирает слово из ${range(min, max)} букв ${picture ? "по картинке" : "на слух"}${extra ? `, есть ${pl(extra, `${extra} лишняя буква`, `${extra} лишние буквы`, `${extra} лишних букв`)}` : ""}`,
    uz: `${range(min, max)} harfli soʻzni ${picture ? "rasmga qarab" : "eshitib"} yigʻadi${extra ? `, ${extra} ta ortiqcha harf bilan` : ""}`,
  }),
);

const doWhatISay = game<SaySettings>(
  "do_what_i_say",
  [
    { mode: "where", options: 2 }, { mode: "where", options: 3 }, { mode: "where", options: 4 },
    { mode: "color", options: 3 }, { mode: "color", options: 4 }, { mode: "size", options: 4 },
    { mode: "text", options: 3, texts: 3 }, { mode: "text", options: 4, texts: 3 }, { mode: "text", options: 4, texts: 3, read: true },
    { mode: "text", options: 3, texts: 4 }, { mode: "text", options: 4, texts: 4 }, { mode: "text", options: 4, texts: 4, read: true },
  ],
  ({ mode, options: n, texts, read }) =>
    ({
      where: { en: `Hears "Show me the cat" and picks it among ${n}`, ru: `Слышит «Где кошка?» и выбирает её среди ${n}`, uz: `«Mushukni koʻrsat» deganni eshitib, ${n} ta rasmdan tanlaydi` },
      color: { en: `Picks a shape by its colour and name, among ${n}`, ru: `Выбирает фигуру по цвету и названию, среди ${n}`, uz: `Shaklni rangi va nomiga qarab ${n} tadan tanlaydi` },
      size: { en: `Picks a shape by size, colour and name, among ${n}`, ru: `Выбирает фигуру по размеру, цвету и названию, среди ${n}`, uz: `Shaklni kattaligi, rangi va nomiga qarab ${n} tadan tanlaydi` },
      text: {
        en: `Answers a question about a ${texts === 3 ? "two-sentence" : "three- or four-sentence"} text${read ? " read alone" : ""}, among ${n}`,
        ru: `Отвечает на вопрос по тексту из ${texts === 3 ? "двух предложений" : "трёх-четырёх предложений"}${read ? ", прочитанному самостоятельно" : ""}, среди ${n}`,
        uz: `${texts === 3 ? "Ikki gapli" : "Uch-toʻrt gapli"} matn${read ? "ni oʻzi oʻqib," : " boʻyicha"} savolga ${n} tadan javob tanlaydi`,
      },
    })[mode],
);
export const SKILL_GAMES: SkillGame[] = [
  findSame, scene, story, sequence, missing, lightPath, sort, maze, puzzle, listenPick, type, count,
  oddOneOut, trackFish, whichWay, cardPairs, shoppingList, nBack, pairsRecall,
  switchSort, opposite, secretRule, nextPattern, balance, pipes, logicHouses, shadowMatch,
  moreLess, numberLine, bazaar, missingNumber, rhyme, wordBuilder, doWhatISay,
] as unknown as SkillGame[]; // prettier-ignore
export const SKILL_GAME_BY_ID: Record<string, SkillGame> = Object.fromEntries(SKILL_GAMES.map((g) => [g.id, g]));
export const stepOf = (g: SkillGame, tier: number, step: number) => g.steps.find((s) => s.tier === tier && s.step === step);
