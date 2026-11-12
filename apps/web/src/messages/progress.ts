import { LANGS, type Lang } from "@/lib/i18n";
import { skills } from "./skills";

// B89, the progress panel (games spec 8 Nov 2026 §8): the parent's and therapist's cards and the child's trees.
// Never a percentage and never a comparison with other children (product rule 1); the child's lines have no numbers.
// uz text drafted 8 Nov 2026 — native-speaker check (B44).
const own: Record<Lang, Record<string, string>> = {
  en: {
    "progress.title": "Skill levels",
    "progress.note": "Levels go from 1 to 100 and show how your child is doing in FlexiKeys games, not a diagnosis.",
    "progress.noteTherapist": "Levels go from 1 to 100 and show how the child is doing in FlexiKeys games, not a diagnosis.",
    "progress.notEnough": "Not enough games yet",
    "progress.level": "Level",
    "progress.now": "Now: {now}.",
    "progress.nowBefore": "Now: {now}. 4 weeks ago: {before}.",
    "progress.weeks": "Level in each of the last 8 weeks: {list}",
    "progress.noWeek": "no games",
    "progress.tries": "Tries in the last 4 weeks",
    "progress.access": "Access events (missed or double taps, left out of the level)",
    "progress.ofTries": "{n} of {total}",
    "progress.tier": "Highest open tier",
    "progress.lock": "The harder tiers of the skill games (Sprout, Tree, Summit) come with Pro.",
    "play.nav.trees": "My trees",
    "play.trees.better": "You got better at {area}!",
    "play.trees.seed": "{area}: a seed. Play and it will grow!",
    "play.trees.tree": "{area}: a growing tree",
  },
  uz: {
    "progress.title": "Koʻnikma darajalari",
    "progress.note": "Darajalar 1 dan 100 gacha. Ular farzandingiz FlexiKeys oʻyinlarida qanday ishlayotganini koʻrsatadi, bu tashxis emas.",
    "progress.noteTherapist": "Darajalar 1 dan 100 gacha. Ular bolaning FlexiKeys oʻyinlarida qanday ishlayotganini koʻrsatadi, bu tashxis emas.",
    "progress.notEnough": "Hozircha oʻyinlar kam",
    "progress.level": "Daraja",
    "progress.now": "Hozir: {now}.",
    "progress.nowBefore": "Hozir: {now}. 4 hafta oldin: {before}.",
    "progress.weeks": "Soʻnggi 8 haftaning har biridagi daraja: {list}",
    "progress.noWeek": "oʻyin yoʻq",
    "progress.tries": "Soʻnggi 4 haftadagi urinishlar",
    "progress.access": "Kirish hodisalari (tegmay qolgan yoki ikki marta bosilgan, darajaga kirmaydi)",
    "progress.ofTries": "{total} tadan {n} ta",
    "progress.tier": "Eng yuqori ochiq bosqich",
    "progress.lock": "Koʻnikma oʻyinlarining qiyinroq bosqichlari (Nihol, Daraxt, Choʻqqi) Pro bilan ochiladi.",
    "play.nav.trees": "Daraxtlarim",
    "play.trees.better": "Barakalla! {area} boʻyicha yaxshiroq boʻlding!",
    "play.trees.seed": "{area}: urugʻ. Oʻyna, u oʻsadi!",
    "play.trees.tree": "{area}: oʻsayotgan daraxt",
  },
  ru: {
    "progress.title": "Уровни навыков",
    "progress.note": "Уровни от 1 до 100 показывают, как ребёнок справляется с играми FlexiKeys. Это не диагноз.",
    "progress.noteTherapist": "Уровни от 1 до 100 показывают, как ребёнок справляется с играми FlexiKeys. Это не диагноз.",
    "progress.notEnough": "Пока мало игр",
    "progress.level": "Уровень",
    "progress.now": "Сейчас: {now}.",
    "progress.nowBefore": "Сейчас: {now}. 4 недели назад: {before}.",
    "progress.weeks": "Уровень в каждую из последних 8 недель: {list}",
    "progress.noWeek": "нет игр",
    "progress.tries": "Попыток за последние 4 недели",
    "progress.access": "Сбои доступа (промах или двойное касание, в уровень не входят)",
    "progress.ofTries": "{n} из {total}",
    "progress.tier": "Самая высокая открытая ступень",
    "progress.lock": "Более сложные ступени игр по навыкам (Росток, Дерево, Вершина) — в Pro.",
    "play.nav.trees": "Мои деревья",
    "play.trees.better": "У тебя стало лучше получаться: {area}!",
    "play.trees.seed": "{area}: семечко. Играй — и оно вырастет!",
    "play.trees.tree": "{area}: растущее дерево",
  },
};

/** ... plus the area and tier names of the skill games, which the adult pages do not load otherwise. */
export const progress = Object.fromEntries(
  LANGS.map((l) => [l, { ...Object.fromEntries(Object.entries(skills[l]).filter(([k]) => k.startsWith("skill.area.") || k.startsWith("skill.tier."))), ...own[l] }]),
) as Record<Lang, Record<string, string>>;
