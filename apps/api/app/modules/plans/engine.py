"""Plan engine, part 2: choosing exercises and games for the 28 days (spec §8, §13). Pure calculation, no database.

A copy of buildRoadmap in apps/web/src/lib/roadmap.ts. Fixed rules, no AI, no randomness: the same inputs always give
the same plan, and every choice comes with a reason a therapist can check. tests/test_plan_engine.py proves the two
give exactly the same plan for every case in roadmap_cases.json.

A4.6: an AI `Choice` (plans/ai_plan.py) may replace which exercises and games go in, never the rules: an exercise the
rules did not allow for this child is dropped, the days, minutes and spacing are still the engine's, and each AI pick
keeps the research entry it cites as its reason's source. With no usable pick the rules plan is used.
"""

import json
import math
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from app.modules.plans.safety import Facts, LibraryExercise, Therapist, exclusion_reason, plan_facts

ENGINE_VERSION = "py-1"  # stored with every plan; change it whenever the rules change
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
GAMES: tuple[str, ...] = tuple(dict.fromkeys(k for kinds in GOAL_GAMES.values() for k in kinds))  # the fixed set
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
    source: str | None = None  # the research entry an AI pick cites (A4.6); None for the rules' own picks


@dataclass(frozen=True)
class Choice:
    """The AI's picks, best first, each with the research entry it cites (A4.6)."""

    exercises: tuple[tuple[str, str], ...]  # (exercise id, source)
    games: tuple[tuple[str, str], ...]  # (game kind, source)


@dataclass(frozen=True)
class BuiltPlan:
    days: list[Day]
    reasons: list[Reason]
    exercises_allowed: bool
    ai: bool = False  # the AI's picks were used


def _exercises_per_day(minutes: int, day: int) -> int:
    return {10: (1, 2), 20: (2, 3)}.get(minutes, (4, 5))[day % 2]


def allowed_exercises(
    f: Facts, library: list[LibraryExercise], lang: str, tools: Collection[str], therapist: Therapist | None
) -> list[LibraryExercise]:
    """The exercises the rules allow for this child now: safe, approved, and not above the child's starting level
    (unless a therapist assigned it). The only ones a plan, the rules' or the AI's, may hold."""
    assign = therapist.assign if therapist else frozenset()
    safe = [ex for ex in library if exclusion_reason(ex, f, lang, tools, therapist) is None]
    return [ex for ex in safe if ex.difficulty <= f.start_level[ex.body_area] or ex.id in assign]


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
    choice: Choice | None = None,
) -> BuiltPlan:
    f = plan_facts(
        answers, birth_date=birth_date, start_date=start_date, health_consent=health_consent, therapist=therapist
    )
    assign = therapist.assign if therapist else frozenset()

    def goal_of(ex: LibraryExercise) -> str | None:
        return next((g for g in f.goals if g in ex.goals), None)

    easy_enough = allowed_exercises(f, library, lang, tools, therapist)
    serving = [ex for ex in easy_enough if goal_of(ex) or ex.id in assign]
    # Therapist's picks first, then by the order of the goals, then by id. ponytail: plain string order equals the
    # website's localeCompare only for lowercase snake_case ids (all of exercises.json).
    pool = sorted(
        serving or easy_enough,
        key=lambda ex: (ex.id not in assign, f.goals.index(goal_of(ex) or f.goals[0]), ex.id),
    )
    # A4.6: the AI's exercises, only those the rules allow, after the therapist's picks; its games from the fixed set.
    allowed = {ex.id: ex for ex in easy_enough}
    ai_ex = dict(p for p in (choice.exercises if choice else ()) if p[0] in allowed and p[0] not in assign)
    ai_games = dict(p for p in (choice.games if choice else ()) if p[0] in GAMES)
    if ai_ex:
        pool = [ex for ex in pool if ex.id in assign] + [allowed[i] for i in ai_ex]

    used: dict[str, int] = {}  # keeps the order of first use, like the website's Map
    games = list(ai_games) or list(dict.fromkeys(kind for g in f.goals for kind in GOAL_GAMES[g]))
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
    reasons = [
        Reason("exercise", goal_of(by_id[i]) or f.goals[0], i, by_id[i].difficulty, ai_ex.get(i)) for i in used
    ] + [
        Reason("game", next((g for g in f.goals if kind in GOAL_GAMES[g]), f.goals[0]), kind, 1, ai_games.get(kind))
        for kind in games
    ]
    return BuiltPlan(days=days, reasons=reasons, exercises_allowed=f.exercises_allowed, ai=bool(ai_ex or ai_games))


def level_after(start: int, feelings: Sequence[str | None]) -> int:
    """An exercise's level after the parent's ratings, oldest first (spec §8). A copy of levelAfter in roadmap.ts:
    two "hard" in a row lower it, two "easy" raise it, within 1-3. "ok" breaks the row; a Done without a rating is
    skipped. A change starts a new row."""
    level, last, row = start, None, 0
    for f in feelings:
        if f is None:
            continue
        row = row + 1 if f == last else 1
        last = f
        if row == 2 and f != "ok":
            level = max(1, min(3, level + (1 if f == "easy" else -1)))
            last = None
    return level
