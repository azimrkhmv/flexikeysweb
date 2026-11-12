"""Skill levels (spec §13), a copy of apps/web/src/lib/skill.ts: one θ per area, moved by every clean try.

θ and a step's difficulty d share one scale: a child with θ = d gets that step right half the time. Parents and
therapists see θ as a level 1-100 (rule 1, 8 Nov 2026); the child never sees a number.
"""

import json
import math
from collections.abc import Mapping, Sequence
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

# The skill areas (games spec 8 Nov 2026, §2.1). `literacy` and `numeracy` keep their stored names; people see
# "Language" and "Math". `access` stays in the model but is a setting, never shown as a skill.
AREAS = ("access", "attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed")

# What each kind of game trains (the four placement games: attention, memory, literacy, flexibility).
AREA_OF: dict[str, str] = {
    **dict.fromkeys(("find_same", "scene", "story"), "attention"),
    **dict.fromkeys(("odd_one_out", "track_fish", "which_way"), "attention"),  # skill games only (games spec §6.1)
    **dict.fromkeys(("sequence", "missing", "light_path"), "memory"),
    **dict.fromkeys(("card_pairs", "shopping_list", "n_back", "pairs_recall"), "memory"),  # §6.2
    **dict.fromkeys(("sort", "maze"), "flexibility"),
    **dict.fromkeys(("switch_sort", "opposite", "secret_rule"), "flexibility"),  # §6.3
    "puzzle": "reasoning",
    **dict.fromkeys(("next_pattern", "balance", "pipes", "logic_houses", "shadow_match"), "reasoning"),  # §6.4
    **dict.fromkeys(("more_less", "number_line", "bazaar", "missing_number"), "numeracy"),  # §6.5
    **dict.fromkeys(("rhyme", "word_builder", "do_what_i_say"), "literacy"),  # §6.6
    **dict.fromkeys(("listen_pick", "type", "sentence"), "literacy"),
    "count": "numeracy",
    **dict.fromkeys(("quick_snap", "tap_star", "fast_sort"), "speed"),  # §7
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

# One row per playable step: {activity_id, kind, level, area, tier, step}. Theme-world games have their world's level;
# skill games (games spec §2.3) have level 0 and twelve steps each.
_ROWS: list[dict[str, Any]] = json.loads((Path(__file__).parents[2] / "content" / "games.json").read_text("utf-8"))
GAMES = [g for g in _ROWS if g["level"] > 0]
SKILL_STEPS = [g for g in _ROWS if g["level"] == 0]
GAME_LIMIT_S = 20 * 60  # the daily game limit (spec §13)


def _level_for(theta: float, p: float, games: list[dict[str, Any]]) -> dict[str, Any]:
    """The step where the child succeeds about `p` of the time: d = theta - ln(p / (1 - p)); a tie keeps the first."""
    want = theta - math.log(p / (1 - p))
    best = games[0]
    for g in games[1:]:
        if abs(difficulty(g["tier"], g["step"]) - want) < abs(difficulty(best["tier"], best["step"]) - want):
            best = g
    return best


TIER_P = 0.85  # a tier opens at this chance of success on the last step of the tier below (games spec §3.2) ...
TIER_TRIES = 20  # ... after this many clean tries in the area since that tier opened
FREE_TIER = 1  # Seed is free in every area; Sprout, Tree and Summit are Pro (decision 8 Nov 2026)


def open_tiers(top: int, theta: float, clean_since: int) -> int:
    """Tiers open by success, never by age (games spec §3.2). `top`: the highest open tier of the area (1 = only
    Seed); `clean_since`: the area's clean tries since that tier opened. Gives the new top tier: one more when theta
    gives at least 85% on the top tier's last step and there were 20 clean tries, else the same. It never goes down."""
    if top < 4 and clean_since >= TIER_TRIES and p_correct(theta, difficulty(top, 3)) >= TIER_P:
        return top + 1
    return top


def open_skill_steps(steps: list[dict[str, Any]], top: Mapping[str, int], pro: bool) -> list[dict[str, Any]]:
    """The skill-game steps the child may play: in an open tier of their area, and above Seed only with Pro. A step
    with `needs_area` also needs that tier of another area (Opposite Day's colour words: Language tier 3)."""
    return [
        g
        for g in steps
        if g["tier"] <= top.get(g["area"], 1)
        and (pro or g["tier"] <= FREE_TIER)
        and (not g.get("needs_area") or top.get(g["needs_area"], 1) >= g["needs_tier"])
    ]


# ---------------------------------------------------------------- Speed (games spec §7)

SPEED_TRIES = 30  # Speed is judged on this many of the child's latest tries (about 3 sessions) ...
SPEED_ACCESS_SHARE = 0.1  # ... and opens only while access events are under this share of them


def speed_open(access: Mapping[str, Any] | None, recent: Sequence[bool]) -> bool:
    """Who gets Speed (§7.1): only a child who plays by touch, with no repeat guard, who may let go of a target, and
    whose access events are under 10% of their latest 30 or more tries. `recent`: whether each of the latest tries was
    an access event. No access settings yet (no play check) = no Speed. Closed again later: Speed hides, θ is kept."""
    if not access or access["input_mode"] != "touch" or access["repeat_lock"] or not access["release_ok"]:
        return False
    return len(recent) >= SPEED_TRIES and sum(1 for r in recent if r) < SPEED_ACCESS_SHARE * len(recent)


# The time to answer one Speed item, in ms (§7.2): Seed 3000, Sprout 2000, Tree 1300, Summit 800 at each tier's first
# step, the steps between spread evenly towards the next tier. Summit stays at 800: never faster.
SPEED_WINDOW_MS = ((3000, 2667, 2333), (2000, 1767, 1533), (1300, 1133, 967), (800, 800, 800))


def speed_window(tier: int, step: int) -> int:
    return SPEED_WINDOW_MS[tier - 1][step - 1]


def speed_correct(correct: bool, response_ms: int | None, tier: int | None, step: int | None) -> bool:
    """A Speed try counts as correct only when the answer is right and came within its step's window (§7.2)."""
    return correct and (not tier or not step or (response_ms is not None and response_ms <= speed_window(tier, step)))


# ---------------------------------------------------------------- Progress panel (games spec §8)

LEVEL_TRIES = 10  # under this many clean tries an area says "Not enough games yet" instead of a level (§8.1)
HISTORY_WEEKS = 8  # weeks in the history line
BEFORE_WEEKS = 4  # how far back "4 weeks ago" is
CAN_DO_DAYS = 14  # "can do now" (§8.2): the hardest step with at least 3 right clean tries in the last 14 days
CAN_DO_RIGHT = 3
TASHKENT = ZoneInfo("Asia/Tashkent")


def skill_level(theta: float) -> int:
    """The level parents and therapists see (rule 1): θ -3 ... 4.5 becomes 1 ... 100. floor(x + 0.5) is the
    website's Math.round (Python's round() rounds halves to even)."""
    return min(100, max(1, math.floor((theta + 3) / 7.5 * 99 + 0.5) + 1))


def shown_level(theta: float, n: int) -> int | None:
    return skill_level(theta) if n >= LEVEL_TRIES else None


def week_start(ts: datetime) -> date:
    """Monday of the week this moment falls in, Tashkent time."""
    day = ts.astimezone(TASHKENT).date()
    return day - timedelta(days=day.weekday())


def top_step(tries: Sequence[Mapping[str, Any]]) -> dict[str, Any] | None:
    """The hardest step with at least 3 right tries (§8.2). `tries`: the area's clean skill-game tries of the last 14
    days ({activity_id, tier, step, correct}, Speed already judged by its window). Same tier and step: more right
    tries first, then the activity id."""
    right: dict[tuple[str, int, int], int] = {}
    for t in tries:
        if t["correct"]:
            key = (t["activity_id"], t["tier"], t["step"])
            right[key] = right.get(key, 0) + 1
    ok = [(k, n) for k, n in right.items() if n >= CAN_DO_RIGHT]
    if not ok:
        return None
    (activity_id, tier, step), _ = min(ok, key=lambda x: (-x[0][1], -x[0][2], -x[1], x[0][0]))
    return {"activity_id": activity_id, "tier": tier, "step": step}


def snapshot_at(snaps: Sequence[Mapping[str, Any]], week: date) -> Mapping[str, Any] | None:
    """The snapshot in force in this week: its own, or the latest before it (θ moves only with tries).
    A snapshot: {week_start: date, theta, n, top: {activity_id, tier, step} | None}."""
    return max((s for s in snaps if s["week_start"] <= week), key=lambda s: s["week_start"], default=None)


def history(snaps: Sequence[Mapping[str, Any]], this_week: date) -> dict[str, Any]:
    """The history line (§8.2): the 8 weeks up to this one, oldest first, each with its level; None before the first
    snapshot or while there were under 10 clean tries. `before`: what the child could do 4 weeks ago."""
    weeks = []
    for k in range(HISTORY_WEEKS):
        week = this_week + timedelta(weeks=k - HISTORY_WEEKS + 1)
        s = snapshot_at(snaps, week)
        weeks.append({"week_start": week, "level": shown_level(s["theta"], s["n"]) if s else None})
    then = snapshot_at(snaps, this_week - timedelta(weeks=BEFORE_WEEKS))
    return {"weeks": weeks, "before": then["top"] if then else None}


def best_level(snaps: Sequence[Mapping[str, Any]], now: int | None) -> int | None:
    """The highest level an area ever showed (the child's tree grows from it and never shrinks, §8.5)."""
    levels = [x for s in snaps if (x := shown_level(s["theta"], s["n"])) is not None]
    if now is not None:
        levels.append(now)
    return max(levels, default=None)


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
