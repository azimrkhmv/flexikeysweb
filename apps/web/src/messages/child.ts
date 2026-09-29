// Side-effect import for child-facing routes (/play, /class, /demo): child mode, activity and AAC strings.
// Each area registers only its own catalogs (lib/translate.ts), keeping the others out of its JavaScript.
import { registerMessages } from "@/lib/translate";
import { aac } from "./aac";
import { activities } from "./activities";
import { play } from "./play";

registerMessages(play, activities, aac);
