// Exercise video library seed (spec §8). Real videos come from the AI generation pipeline and are registered by
// an admin; here every exercise has its tags and empty demo files. Only physio-approved versions reach a roadmap.

import type { AgeBand, BodyArea, ExerciseVideo, FnLevel, GoalKey, L10n, Restriction } from "@/lib/types";

/** Standard Home Kit (spec §9). Still open: the exact list. */
export const KIT_TOOLS = ["putty", "tongs", "lacing", "pegboard", "foam_ball", "bean_bags", "foot_discs", "cards"] as const;
export type KitTool = (typeof KIT_TOOLS)[number];

const ALL: FnLevel[] = [1, 2, 3, 4, 5];
const UP_TO_3: FnLevel[] = [1, 2, 3];
const UP_TO_2: FnLevel[] = [1, 2];
const KIDS: AgeBand[] = ["2-4", "5-8", "9-12"];
const ALL_AGES: AgeBand[] = ["2-4", "5-8", "9-12", "13-20"];
const OLDER: AgeBand[] = ["5-8", "9-12", "13-20"];

type Row = [id: string, title: [en: string, uz: string, ru: string], area: BodyArea, goals: GoalKey[], gmfcs: FnLevel[], ages: AgeBand[], tool: KitTool | null, difficulty: 1 | 2 | 3, conflicts: Restriction[]];

const ROWS: Row[] = [
  // Hands
  ["putty_squeeze", ["Squeeze the putty", "Plastilinni siqish", "Сжимаем пластилин"], "hands", ["hands"], ALL, ALL_AGES, "putty", 1, []],
  ["putty_pinch", ["Pinch little balls", "Kichik sharchalar uzish", "Отщипываем шарики"], "hands", ["hands", "eat"], ALL, ALL_AGES, "putty", 2, []],
  ["tongs_pompoms", ["Pom-poms with tongs", "Qisqich bilan pompon", "Помпоны щипцами"], "hands", ["hands", "school"], ALL, ALL_AGES, "tongs", 2, []],
  ["tongs_sort", ["Sort by colour with tongs", "Qisqich bilan rangga ajratish", "Сортируем щипцами по цвету"], "hands", ["hands", "understand"], ALL, OLDER, "tongs", 3, []],
  ["pegboard_big", ["Big pegs in, big pegs out", "Katta qoziqlarni qoʻyish", "Большие колышки"], "hands", ["hands"], ALL, KIDS, "pegboard", 1, []],
  ["pegboard_pattern", ["Copy a peg pattern", "Naqshni takrorlash", "Повторяем узор из колышков"], "hands", ["hands", "understand", "school"], ALL, OLDER, "pegboard", 3, []],
  ["lacing_card", ["Lacing card", "Ip oʻtkazish kartasi", "Карточка-шнуровка"], "hands", ["hands", "school"], ALL, OLDER, "lacing", 2, []],
  ["finger_walk", ["Finger walk", "Barmoqlar sayri", "Пальчики гуляют"], "hands", ["hands"], ALL, ALL_AGES, null, 1, []],
  ["spoon_scoop", ["Scoop with a spoon", "Qoshiq bilan olish", "Набираем ложкой"], "hands", ["eat", "hands"], ALL, KIDS, null, 1, []],
  // Arms
  ["ball_roll_seated", ["Roll the ball while sitting", "Oʻtirib toʻp dumalatish", "Катаем мяч сидя"], "arms", ["hands", "play_others"], ALL, ALL_AGES, "foam_ball", 1, []],
  ["bean_bag_target", ["Bean bag to the target", "Xaltachani nishonga", "Мешочек в цель"], "arms", ["hands", "play_others"], UP_TO_3, ALL_AGES, "bean_bags", 2, []],
  ["reach_up_seated", ["Reach for the sky (sitting)", "Osmonga choʻzilish (oʻtirib)", "Тянемся вверх сидя"], "arms", ["sit", "hands"], ALL, ALL_AGES, null, 1, []],
  ["catch_soft_ball", ["Catch the soft ball", "Yumshoq toʻpni ilish", "Ловим мягкий мяч"], "arms", ["play_others", "hands"], UP_TO_3, OLDER, "foam_ball", 3, ["standing"]],
  // Trunk / sitting
  ["sit_reach_sides", ["Sit and reach to the sides", "Oʻtirib yon tomonga choʻzilish", "Сидя тянемся в стороны"], "trunk", ["sit"], ALL, ALL_AGES, "bean_bags", 1, []],
  ["sit_ball_pass", ["Pass the ball around you", "Toʻpni atrofdan aylantirish", "Передаём мяч вокруг себя"], "trunk", ["sit", "play_others"], ALL, ALL_AGES, "foam_ball", 2, []],
  ["tummy_time_reach", ["Tummy time reach", "Qorinda yotib choʻzilish", "Лёжа на животе тянемся"], "trunk", ["sit", "hands"], ALL, KIDS, "foam_ball", 1, ["prone"]],
  ["bridge", ["Little bridge", "Kichik koʻprik", "Мостик"], "trunk", ["walk", "sit"], UP_TO_3, ALL_AGES, null, 2, ["high_intensity"]],
  ["side_sit_play", ["Side-sitting play", "Yonboshlab oʻtirib oʻynash", "Игра сидя на боку"], "trunk", ["sit"], ALL, KIDS, "cards", 2, []],
  // Head and neck
  ["look_left_right", ["Look left, look right", "Chapga, oʻngga qarash", "Смотрим влево-вправо"], "head_neck", ["sit", "understand"], ALL, KIDS, "cards", 1, ["neck_flexion"]],
  ["chin_tuck", ["Chin to chest, slowly", "Iyakni koʻkrakka sekin", "Подбородок к груди"], "head_neck", ["sit"], ALL, OLDER, null, 2, ["neck_flexion"]],
  // Legs (standing, walking, balance)
  ["sit_to_stand", ["Sit to stand", "Oʻtirgan joydan turish", "Встаём со стула"], "legs", ["walk"], UP_TO_3, ALL_AGES, null, 1, ["standing"]],
  ["foot_discs_steps", ["Steps on the touch discs", "Sezgi disklarida qadam", "Шаги по тактильным дискам"], "legs", ["walk"], UP_TO_2, ALL_AGES, "foot_discs", 2, ["standing", "walking"]],
  ["walk_line", ["Walk along the line", "Chiziq boʻylab yurish", "Идём по линии"], "legs", ["walk"], UP_TO_2, ALL_AGES, null, 2, ["standing", "walking", "leg_balance"]],
  ["one_leg_stand", ["Stand on one leg", "Bir oyoqda turish", "Стоим на одной ноге"], "legs", ["walk"], UP_TO_2, OLDER, null, 3, ["standing", "leg_balance", "single_leg_weight"]],
  ["bunny_hops", ["Bunny hops", "Quyoncha sakrashi", "Прыжки зайчика"], "legs", ["walk", "play_others"], [1], ALL_AGES, null, 3, ["standing", "jumping", "high_intensity", "leg_balance"]],
  ["kick_ball", ["Kick the soft ball", "Yumshoq toʻpni tepish", "Пинаем мягкий мяч"], "legs", ["walk", "play_others"], UP_TO_2, ALL_AGES, "foam_ball", 2, ["standing", "single_leg_weight", "leg_balance"]],
  ["seated_leg_lifts", ["Leg lifts while sitting", "Oʻtirib oyoq koʻtarish", "Подъём ног сидя"], "legs", ["walk", "sit"], ALL, ALL_AGES, null, 1, []],
  ["seated_foot_discs", ["Feel the discs with your feet", "Oyoq bilan disklarni sezish", "Ощупываем диски ногами"], "legs", ["walk"], ALL, ALL_AGES, "foot_discs", 1, []],
  // Mouth and face
  ["blow_bubbles", ["Blow like the wind", "Shamoldek puflash", "Дуем как ветер"], "mouth_face", ["communicate", "eat"], ALL, ALL_AGES, null, 1, ["mouth_face"]],
  ["funny_faces", ["Funny faces in the mirror", "Koʻzguda kulgili yuzlar", "Смешные рожицы"], "mouth_face", ["communicate"], ALL, KIDS, null, 1, ["mouth_face"]],
  ["sound_cards", ["Say it with the picture cards", "Rasmli kartalar bilan aytish", "Говорим по карточкам"], "mouth_face", ["communicate", "understand"], ALL, ALL_AGES, "cards", 2, []],
  ["emotion_cards", ["Show the feeling", "Hissiyotni koʻrsatish", "Покажи чувство"], "head_neck", ["communicate", "play_others"], ALL, ALL_AGES, "cards", 1, []],
  ["sequence_cards", ["What comes next? (cards)", "Keyin nima? (kartalar)", "Что дальше? (карточки)"], "hands", ["understand", "school"], ALL, OLDER, "cards", 2, []],
];

/** Demo statuses: most exercises approved in every language, a few waiting in the physio queue. */
const QUEUED = new Set(["tongs_sort", "pegboard_pattern", "funny_faces", "catch_soft_ball"]);

export function exerciseLibrary(approvedBy: string, at: string): ExerciseVideo[] {
  return ROWS.map(([id, [en, uz, ru], bodyArea, goals, gmfcs, ages, tool, difficulty, conflicts]) => {
    const title: L10n = { en, uz, ru };
    const v = () =>
      QUEUED.has(id) ? { url: "", durationS: 90, status: "generated" as const, notes: [] } : { url: "", durationS: 90, status: "approved" as const, approvedBy, approvedAt: at, notes: [] };
    return { id, title, bodyArea, goals, gmfcs, ages, tool, difficulty, conflicts, versions: { uz: v(), ru: v(), en: v() } };
  });
}
