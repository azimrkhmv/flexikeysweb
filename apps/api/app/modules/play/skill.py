"""Skill levels (spec §13), a copy of apps/web/src/lib/skill.ts: one θ per area, moved by every clean try.

θ and a step's difficulty d share one scale: a child with θ = d gets that step right half the time. Parents and
therapists see θ as a level 1-100 (rule 1, 8 Nov 2026); the child never sees a number.
"""

import json
import math
from collections.abc import Mapping
from datetime import date, timedelta
from pathlib import Path
from typing import Any

# The skill areas (games spec 8 Nov 2026, §2.1). `literacy` and `numeracy` keep their stored names; people see
# "Language" and "Math". `access` stays in the model but is a setting, never shown as a skill.
AREAS = ("access", "attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed")

# What each kind of game trains (the four placement games: attention, memory, literacy, flexibility).
AREA_OF: dict[str, str] = {
    **dict.fromkeys(("find_same", "scene", "story"), "attention"),
    **dict.fromkeys(("sequence", "missing", "light_path"), "memory"),
    **dict.fromkeys(("sort", "maze"), "flexibility"),
    "puzzle": "reasoning",
    **dict.fromkeys(("listen_pick", "type", "sentence"), "literacy"),
    "count": "numeracy",
    **dict.fromkeys(("path", "trace", "dots", "color", "paint"), "access"),
}

STEP = 1.5  # one bucket step (not yet -> with help -> yes)


def difficulty(tier: int, step: int) -> float:
    """Difficulty of a step: 12 evenly spaced steps from Seed 1 (-1.5) to Summit 3 (2.9)."""
    return ((tier - 1) * 3 + (step - 1)) * 0.4 - STEP


def level_difficulty(level: int) -> float:
    """The old difficulty of a world level (1, 2, 3, ...), for tries that have only a level."""
    return (level - 1) * 0.3 - STEP


def try_difficulty(level: int, tier: int | None, step: int | None) -> float:
    """A try's difficulty: from its tier and step when it has both, else from its world level (old tries)."""
    return difficulty(tier, step) if tier and step else level_difficulty(level)


def p_correct(theta: float, d: float) -> float:
    """P(correct) = 1 / (1 + e^-(theta - d))."""
    return 1 / (1 + math.exp(-(theta - d)))


def elo(theta: float, n: int, d: float, correct: bool) -> float:
    """After every clean try: theta_new = theta + K (correct - P(correct)), K = 1 / (1 + 0.05 n)."""
    return theta + (1 / (1 + 0.05 * n)) * ((1 if correct else 0) - p_correct(theta, d))


# The intake's ability answers (0-2 each) that tell about each area. ponytail: a first mapping, to be checked with the
# physiotherapist (TASKS.md C8); numeracy has no question yet, so it starts in the middle. Reasoning and speed have no
# question: they start from another area's θ (START_FROM).
AREA_QUESTIONS: dict[str, tuple[str, ...]] = {
    "access": ("P23", "P24", "P26"),
    "attention": ("P30",),
    "memory": ("P19",),
    "flexibility": ("P32",),
    "reasoning": (),
    "literacy": ("P18", "P20", "P21"),
    "numeracy": (),
    "speed": (),
}

# A new area with no intake question starts at the child's current θ of this area (games spec §2.1).
START_FROM: dict[str, str] = {"reasoning": "flexibility", "speed": "attention"}

BUCKET_THETA = {"not_yet": -STEP, "with_help": 0.0, "yes": STEP}


def starting_theta(area: str, parent: Mapping[str, Any], therapist: Mapping[str, Any] | None = None) -> float:
    """1. The first guess from the intake: answers 0-2 give -1.5...+1.5; a therapist's answers count twice."""
    total = weight = 0.0
    for q in AREA_QUESTIONS[area]:
        for answers, w in ((parent, 1), (therapist or {}, 2)):
            v = answers.get(q)
            if isinstance(v, int | float) and not isinstance(v, bool):
                total += v * w
                weight += w
    return (total / weight) * STEP - STEP if weight else 0.0


def corrected(theta: float, bucket: str) -> float:
    """2. Corrected by the play check: the play check wins, but moves the guess by one step at most."""
    return theta + max(-STEP, min(STEP, BUCKET_THETA[bucket] - theta))


# ---------------------------------------------------------------- choosing games

# One row per playable step: {activity_id, kind, level, area, tier, step}; skill games have level 0.
GAMES: list[dict[str, Any]] = json.loads((Path(__file__).parents[2] / "content" / "games.json").read_text("utf-8"))
GAME_LIMIT_S = 20 * 60  # the daily game limit (spec §13)


def _level_for(theta: float, p: float, games: list[dict[str, Any]]) -> dict[str, Any]:
    """The step where the child succeeds about `p` of the time: d = theta - ln(p / (1 - p)); a tie keeps the first."""
    want = theta - math.log(p / (1 - p))
    best = games[0]
    for g in games[1:]:
        if abs(difficulty(g["tier"], g["step"]) - want) < abs(difficulty(best["tier"], best["step"]) - want):
            best = g
    return best


def weekly_new(unlocked: list[dict[str, Any]], first_played: Mapping[str, str], today: str) -> list[dict[str, Any]]:
    """At most one new kind of game a week; a game already played is never taken away. Dates are YYYY-MM-DD.
    A new tier of a kind already played is not a new kind."""
    week_ago = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
    new_this_week = any(d > week_ago for d in first_played.values())
    fresh = next((g["kind"] for g in unlocked if g["kind"] not in first_played), None)
    return [g for g in unlocked if g["kind"] in first_played or (not new_this_week and g["kind"] == fresh)]


def choose_games(theta: Mapping[str, float], unlocked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Three slots: an easy win from the strongest area (~85%), growth from the weakest area that has a game (~75%),
    and the child's own choice of any unlocked game."""
    with_games = [a for a in AREAS if any(g["area"] == a for g in unlocked)]
    if not with_games:
        return []
    by_theta = sorted(with_games, key=lambda a: -theta[a])
    strongest, weakest = by_theta[0], by_theta[-1]

    def pick(area: str, p: float) -> dict[str, Any]:
        return _level_for(theta[area], p, [g for g in unlocked if g["area"] == area])

    return [
        {"slot": "easy_win", "area": strongest, "games": [pick(strongest, 0.85)]},
        {"slot": "growth", "area": weakest, "games": [pick(weakest, 0.75)]},
        {"slot": "choice", "area": None, "games": unlocked},
    ]
