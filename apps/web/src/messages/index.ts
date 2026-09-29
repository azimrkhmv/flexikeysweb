import { aac } from "./aac";
import { activities } from "./activities";
import { auth } from "./auth";
import { common } from "./common";
import { marketing } from "./marketing";
import { parent } from "./parent";
import { play } from "./play";
import { pro } from "./pro";

// All catalogs by area — for tests. Routes register catalogs through ./public, ./child and ./adult (lib/translate.ts).
export const areaMessages = { common, marketing, auth, play, activities, aac, parent, pro };
