import type { Roadmap } from "@/lib/types";

export interface PlanGame {
  kind: string;
  minutes: number;
  /** In today's task. */
  today: boolean;
}

/**
 * The games of a child's plan for the parent's Games page (B96): today's first, then the rest in plan order, each kind
 * once. `today` is the plan day (null on a rest day or outside the plan); on Free only the days Free includes.
 */
export function planGames(plan: Pick<Roadmap, "days">, today: number | null, freeDays: number | null): PlanGame[] {
  const days = freeDays === null ? plan.days : plan.days.slice(0, freeDays);
  const found = new Map<string, PlanGame>();
  const add = (games: { kind: string; minutes: number }[], isToday: boolean) => {
    for (const g of games) if (!found.has(g.kind)) found.set(g.kind, { kind: g.kind, minutes: g.minutes, today: isToday });
  };
  if (today !== null && days[today]) add(days[today].games, true);
  for (const d of days) add(d.games, false);
  return [...found.values()];
}
