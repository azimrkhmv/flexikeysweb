"""Skill levels (spec §13), a copy of apps/web/src/lib/skill.ts: one θ per area, moved by every clean try.

θ and a game level's difficulty d share one scale: a child with θ = d gets that level right half the time.
"""

import math

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
