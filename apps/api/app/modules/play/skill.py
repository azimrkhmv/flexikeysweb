"""Skill levels (spec §13), a copy of apps/web/src/lib/skill.ts: one θ per area, moved by every clean try.

θ and a game level's difficulty d share one scale: a child with θ = d gets that level right half the time.
"""

import json
import math
from collections.abc import Mapping
from datetime import date, timedelta
from pathlib import Path
from typing import Any

AREAS = ("access", "attention", "memory", "flexibility", "literacy", "numeracy")

# What each kind of game trains (the four placement games: attention, memory, literacy, flexibility).
AREA_OF: dict[str, str] = {
    **dict.fromkeys(("find_same", "scene", "story"), "attention"),
    **dict.fromkeys(("sequence", "missing", "light_path"), "memory"),
    **dict.fromkeys(("sort", "puzzle", "maze"), "flexibility"),
    **dict.fromkeys(("listen_pick", "type", "sentence"), "literacy"),
    "count": "numeracy",
    **dict.fromkeys(("path", "trace", "dots", "color", "paint"), "access"),
}

STEP = 1.5  # one bucket step (not yet -> with help -> yes)


def difficulty(level: int) -> float:
    """Difficulty of a world level (1, 2, 3, ...). ponytail: evenly spaced; tune once tries show real success rates."""
    return (level - 1) * 0.3 - STEP


def p_correct(theta: float, d: float) -> float:
    """P(correct) = 1 / (1 + e^-(theta - d))."""
    return 1 / (1 + math.exp(-(theta - d)))


def elo(theta: float, n: int, d: float, correct: bool) -> float:
    """After every clean try: theta_new = theta + K (correct - P(correct)), K = 1 / (1 + 0.05 n)."""
    return theta + (1 / (1 + 0.05 * n)) * ((1 if correct else 0) - p_correct(theta, d))


# The intake's ability answers (0-2 each) that tell about each area. ponytail: a first mapping, to be checked with the
# physiotherapist (TASKS.md C8); numeracy has no question yet, so it starts in the middle.
AREA_QUESTIONS: dict[str, tuple[str, ...]] = {
    "access": ("P23", "P24", "P26"),
    "attention": ("P30",),
    "memory": ("P19",),
    "flexibility": ("P32",),
    "literacy": ("P18", "P20", "P21"),
    "numeracy": (),
}

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

GAMES: list[dict[str, Any]] = json.loads((Path(__file__).parents[2] / "content" / "games.json").read_text("utf-8"))
GAME_LIMIT_S = 20 * 60  # the daily game limit (spec §13)


def _level_for(theta: float, p: float, games: list[dict[str, Any]]) -> dict[str, Any]:
    """The level where the child succeeds about `p` of the time: d = theta - ln(p / (1 - p)); a tie keeps the first."""
    want = theta - math.log(p / (1 - p))
    best = games[0]
    for g in games[1:]:
        if abs(difficulty(g["level"]) - want) < abs(difficulty(best["level"]) - want):
            best = g
    return best


def weekly_new(unlocked: list[dict[str, Any]], first_played: Mapping[str, str], today: str) -> list[dict[str, Any]]:
    """At most one new kind of game a week; a game already played is never taken away. Dates are YYYY-MM-DD."""
    week_ago = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
    new_this_week = any(d > week_ago for d in first_played.values())
    fresh = next((g["kind"] for g in unlocked if g["kind"] not in first_played), None)
    return [g for g in unlocked if g["kind"] in first_played or (not new_this_week and g["kind"] == fresh)]


def choose_games(theta: Mapping[str, float], unlocked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Three slots: an easy win from the strongest area (~85%), growth from the weakest area that has a game (~75%),
    and the child's own choice of any unlocked game."""
    with_games = [a for a in AREAS if any(AREA_OF[g["kind"]] == a for g in unlocked)]
    if not with_games:
        return []
    by_theta = sorted(with_games, key=lambda a: -theta[a])
    strongest, weakest = by_theta[0], by_theta[-1]

    def pick(area: str, p: float) -> dict[str, Any]:
        return _level_for(theta[area], p, [g for g in unlocked if AREA_OF[g["kind"]] == area])

    return [
        {"slot": "easy_win", "area": strongest, "games": [pick(strongest, 0.85)]},
        {"slot": "growth", "area": weakest, "games": [pick(weakest, 0.75)]},
        {"slot": "choice", "area": None, "games": unlocked},
    ]
