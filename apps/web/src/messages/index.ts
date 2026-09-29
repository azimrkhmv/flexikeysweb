import { aac } from "./aac";
import { activities } from "./activities";
import { auth } from "./auth";
import { common } from "./common";
import { marketing } from "./marketing";
import { parent } from "./parent";
import { play } from "./play";
import { pro } from "./pro";

const areas = [common, marketing, auth, play, activities, aac, parent, pro];

type Dict = Record<string, string>;
const merge = (lang: "en" | "uz" | "ru"): Dict => Object.assign({}, ...areas.map((a) => a[lang] as Dict));

export const messages = { en: merge("en"), uz: merge("uz"), ru: merge("ru") };
export const areaMessages = { common, marketing, auth, play, activities, aac, parent, pro };
