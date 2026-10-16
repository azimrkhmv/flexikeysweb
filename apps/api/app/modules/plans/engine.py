"""Plan engine, part 2: choosing exercises and games for the 28 days (spec §8, §13). Pure calculation, no database.

A copy of buildRoadmap in apps/web/src/lib/roadmap.ts. Fixed rules, no AI, no randomness: the same inputs always give
the same plan, and every choice comes with a reason a therapist can check. tests/test_plan_engine.py proves the two
give exactly the same plan for every case in roadmap_cases.json.
"""

import json
import math
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from app.modules.plans.safety import LibraryExercise, Therapist, exclusion_reason, plan_facts

DAYS = 28
GAME_LIMIT_MIN = 20
GAME_SLOT_MIN = 5
# Games that serve each goal.
GOAL_GAMES: dict[str, tuple[str, ...]] = {
    "walk": ("path", "light_path"),
    "hands": ("trace", "color", "dots"),
    "sit": ("find_same", "scene"),
    "communicate": ("listen_pick", "sentence"),
    "understand": ("missing", "sort", "sequence"),
    "eat": ("sort", "find_same"),
    "play_others": ("story", "scene"),
    "school": ("count", "type", "trace"),
}
# The tools in the standard Home Kit box.
KIT_TOOLS: tuple[str, ...] = tuple(
    json.loads((Path(__file__).parents[2] / "content" / "exercises.json").read_text("utf-8"))["kit_tools"]
)


@dataclass(frozen=True)
class Day:
    date: date
    exercises: list[tuple[str, int]]  # (exercise id, level)
    games: list[tuple[str, int]]  # (game kind, minutes)


@dataclass(frozen=True)
class Reason:
    slot: str  # "exercise" or "game"
    goal: str
    ref: str
    level: int


@dataclass(frozen=True)
class BuiltPlan:
    days: list[Day]
    reasons: list[Reason]
    exercises_allowed: bool


def _exercises_per_day(minutes: int, day: int) -> int:
    return {10: (1, 2), 20: (2, 3)}.get(minutes, (4, 5))[day % 2]


def build_plan(
    answers: Mapping[str, Any],
    library: list[LibraryExercise],
    *,
    birth_date: date,
    start_date: date,
    lang: str,
    health_consent: bool,
    therapist: Therapist | None = None,
    tools: Collection[str] = KIT_TOOLS,
) -> BuiltPlan:
    f = plan_facts(
        answers, birth_date=birth_date, start_date=start_date, health_consent=health_consent, therapist=therapist
    )
    assign = therapist.assign if therapist else frozenset()

    def goal_of(ex: LibraryExercise) -> str | None:
        return next((g for g in f.goals if g in ex.goals), None)

    safe = [ex for ex in library if exclusion_reason(ex, f, lang, tools, therapist) is None]
    easy_enough = [ex for ex in safe if ex.difficulty <= f.start_level[ex.body_area] or ex.id in assign]
    serving = [ex for ex in easy_enough if goal_of(ex) or ex.id in assign]
    # Therapist's picks first, then by the order of the goals, then by id. ponytail: plain string order equals the
    # website's localeCompare only for lowercase snake_case ids (all of exercises.json).
    pool = sorted(
        serving or easy_enough,
        key=lambda ex: (ex.id not in assign, f.goals.index(goal_of(ex) or f.goals[0]), ex.id),
    )

    used: dict[str, int] = {}  # keeps the order of first use, like the website's Map
    games = list(dict.fromkeys(kind for g in f.goals for kind in GOAL_GAMES[g]))
    game_slots = min(GAME_LIMIT_MIN, math.ceil(f.minutes / 2)) // GAME_SLOT_MIN
    days: list[Day] = []
    yesterday_areas: set[str] = set()
    yesterday_ids: set[str] = set()

    for d in range(DAYS):
        want = min(_exercises_per_day(f.minutes, d), len(pool))
        picked: list[LibraryExercise] = []

        # Least used first; avoid yesterday's body areas and repeating an area today; relax only if the pool is small.
        for strict in (2, 1, 0):
            while len(picked) < want:
                best = min(
                    (
                        ex
                        for ex in pool
                        if ex not in picked
                        and ex.id not in yesterday_ids
                        and (strict < 1 or ex.body_area not in yesterday_areas)
                        and (strict < 2 or all(p.body_area != ex.body_area for p in picked))
                    ),
                    key=lambda ex: (used.get(ex.id, 0), pool.index(ex)),
                    default=None,
                )
                if best is None:
                    break
                picked.append(best)
        for ex in picked:
            used[ex.id] = used.get(ex.id, 0) + 1
        yesterday_areas = {ex.body_area for ex in picked}
        yesterday_ids = {ex.id for ex in picked}
        days.append(
            Day(
                date=start_date + timedelta(days=d),
                exercises=[(ex.id, ex.difficulty) for ex in picked],
                games=[(games[(d * game_slots + k) % len(games)], GAME_SLOT_MIN) for k in range(game_slots)],
            )
        )

    by_id = {ex.id: ex for ex in pool}
    reasons = [Reason("exercise", goal_of(by_id[i]) or f.goals[0], i, by_id[i].difficulty) for i in used] + [
        Reason("game", next(g for g in f.goals if kind in GOAL_GAMES[g]), kind, 1) for kind in games
    ]
    return BuiltPlan(days=days, reasons=reasons, exercises_allowed=f.exercises_allowed)
