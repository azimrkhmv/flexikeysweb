import { LEVELS } from "@/content/levels";
import type { Activity, Level } from "@/lib/types";

// Every game in every level, sorted into groups by what the child does (shown beside the world map).
// Content order (level 1 → 16) is kept inside a group; levels themselves stay independent.

export const GROUPS = ["words", "choose", "memory", "puzzles", "drawing", "stories"] as const;
export type GroupId = (typeof GROUPS)[number];

export const GROUP_EMOJI: Record<GroupId, string> = {
  words: "✍️",
  choose: "👀",
  memory: "🧠",
  puzzles: "🧩",
  drawing: "✏️",
  stories: "📖",
};

/** The group a game belongs to. Exhaustive: a new activity kind won't compile until it has a group. */
export function groupOf(a: Activity): GroupId {
  switch (a.kind) {
    case "type":
    case "sentence":
      return "words";
    case "listen_pick":
    case "find_same":
    case "count":
    case "scene":
      return "choose";
    case "sequence":
    case "light_path":
    case "missing":
      return "memory";
    case "sort":
    case "puzzle":
    case "maze":
      return "puzzles";
    case "trace":
    case "dots":
    case "color":
    case "paint":
    case "path":
      return "drawing";
    case "story":
      return "stories";
    default: {
      const never: never = a;
      return never;
    }
  }
}

/** i18n key naming one game (typing games say which kind of typing). */
export const activityLabelKey = (a: Activity) => (a.kind === "type" ? `play.kind.type.${a.mode}` : `play.kind.${a.kind}`);

export interface GroupedTask {
  level: Level;
  activity: Activity;
}

/** All games of all levels, by group (groups without games are left out). */
export function tasksByGroup(levels: readonly Level[] = LEVELS): { id: GroupId; tasks: GroupedTask[] }[] {
  return GROUPS.map((id) => ({
    id,
    tasks: levels.flatMap((level) => level.activities.filter((a) => groupOf(a) === id).map((activity) => ({ level, activity }))),
  })).filter((g) => g.tasks.length > 0);
}
