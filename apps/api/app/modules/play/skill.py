"""Skill levels (spec §13), a copy of apps/web/src/lib/skill.ts: one θ per area, moved by every clean try.

θ and a game level's difficulty d share one scale: a child with θ = d gets that level right half the time.
"""

import math
from collections.abc import Mapping
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
