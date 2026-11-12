import { LANGS, type Lang } from "@/lib/i18n";
import { intake } from "./intake";
import { skills } from "./skills";

/**
 * B88: the skill-only games in a plan (parent Today, the plan tab, the therapist's reasons) are named as in the child's
 * Skill games tab: `game.<kind>` = `skill.game.<kind>`, for every kind `intake.ts` has no `game.` name for.
 */
export const planGames = Object.fromEntries(
  LANGS.map((l) => [
    l,
    Object.fromEntries(
      Object.entries(skills[l])
        .filter(([k]) => k.startsWith("skill.game.") && !(`game.${k.slice("skill.game.".length)}` in intake[l]))
        .map(([k, v]) => [`game.${k.slice("skill.game.".length)}`, v]),
    ),
  ]),
) as Record<Lang, Record<string, string>>;
