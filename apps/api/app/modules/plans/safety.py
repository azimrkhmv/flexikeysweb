"""Plan engine, part 1: the safety filter (spec §8, §13 step 2). Pure calculation, no database.

A copy of planFacts and exclusionReason in apps/web/src/lib/roadmap.ts; the two must always agree (A4.3 checks the
whole plan against roadmap_cases.json). Answers are the intake answers by question id: a missing key = not answered,
None = "Not sure". Both are read as the cautious answer: safety beats convenience (product rule 2).
"""

from collections.abc import Collection, Mapping
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal

Level = Literal[1, 2, 3]

P14_TAGS = ("jumping", "prone", "neck_flexion", "single_leg_weight")
GOALS = ("walk", "hands", "sit", "communicate", "understand", "eat", "play_others", "school")
DEFAULT_GOALS = ("hands", "sit", "communicate")  # P33 "Not sure": start broad and gentle
# P12 to GMFCS I to V. "Not sure" stays None (= sitting exercises only until a therapist confirms).
P12_GMFCS = {"walks": 1, "walks_help": 2, "walker": 3, "wheelchair": 4, "needs_help_sit": 5}


@dataclass(frozen=True)
class Therapist:
    """What a linked therapist set. It wins over the parent's answers (product rule 4)."""

    restrictions: frozenset[str] = frozenset()
    goals: tuple[str, ...] = ()
    assign: frozenset[str] = frozenset()
    exclude: frozenset[str] = frozenset()
    leg_balance_approved: bool = False
    gmfcs: int | None = None


@dataclass(frozen=True)
class LibraryExercise:
    """One exercise of exercises.json, plus the languages its video is approved in."""

    id: str
    body_area: str
    goals: tuple[str, ...]
    gmfcs: tuple[int, ...]
    ages: tuple[str, ...]
    tool: str | None
    difficulty: int
    conflicts: tuple[str, ...]
    approved: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class Facts:
    exercises_allowed: bool
    gmfcs: int | None
    restrictions: frozenset[str]
    surgery: frozenset[str]
    goals: tuple[str, ...]
    minutes: int
    start_level: Mapping[str, Level]
    band: str


def _list(v: Any) -> list[Any]:
    return v if isinstance(v, list) else []


def _num(v: Any) -> float | None:
    return v if isinstance(v, int | float) and not isinstance(v, bool) else None


def _level(*xs: float | None) -> Level:
    """0-2 ability average to a starting difficulty 1-3. Unknown is 1."""
    known = [x for x in xs if x is not None]
    if not known:
        return 1
    score = sum(known) / len(known)
    return 1 if score < 1 else 2 if score < 1.7 else 3


def age_band(birth_date: date, on: date) -> str:
    years = on.year - birth_date.year - ((on.month, on.day) < (birth_date.month, birth_date.day))
    return "2-4" if years <= 4 else "5-8" if years <= 8 else "9-12" if years <= 12 else "13-20"


def plan_facts(
    answers: Mapping[str, Any],
    *,
    birth_date: date,
    start_date: date,
    health_consent: bool,
    therapist: Therapist | None = None,
) -> Facts:
    """Everything the rules need, derived from the answers. Therapist answers win (spec §6)."""
    a, th = answers, therapist
    p12 = a.get("P12")
    gmfcs = th.gmfcs if th and th.gmfcs is not None else None
    if gmfcs is None and health_consent and isinstance(p12, str):
        gmfcs = P12_GMFCS.get(p12)

    restrictions = set(th.restrictions if th else ())
    # P14: the listed tags; "Not sure" or unanswered = every listed restriction is present.
    p14 = a.get("P14")
    restrictions.update(P14_TAGS if p14 is None else (r for r in _list(p14) if r in P14_TAGS))
    if gmfcs is None or gmfcs >= 4:
        restrictions.update(("standing", "walking"))
    if "cp" in _list(a.get("P9")) and not (th and th.leg_balance_approved):
        restrictions.add("leg_balance")
    if a.get("P13") not in ("never", "earlier"):  # seizures in the last year, or "Not sure"
        restrictions.add("high_intensity")
    if a.get("P15") not in ("no", "yes"):  # surgery "Not sure"
        restrictions.add("high_intensity")
    if a.get("P17") != "no":
        restrictions.add("mouth_face")

    surgery = frozenset(_list(a.get("P15_part")) if a.get("P15") == "yes" else ())
    parent_goals = tuple(g for g in _list(a.get("P33")) if g in GOALS)
    goals = th.goals if th and th.goals else parent_goals or DEFAULT_GOALS
    p34 = a.get("P34")
    minutes = 20 if p34 == "20" else 30 if p34 == "30" else 10  # "Not sure" = the shortest plan

    hands = _level(_num(a.get("P23")), _num(a.get("P24")), _num(a.get("P26")))
    talk = _level(_num(a.get("P20")), _num(a.get("P21")))
    move: Level = 1 if gmfcs is None or gmfcs >= 4 else 2 if gmfcs == 3 else 3
    start_level: dict[str, Level] = {
        "hands": hands, "arms": hands, "legs": move, "trunk": move, "head_neck": move, "mouth_face": talk,
    }  # fmt: skip
    return Facts(
        exercises_allowed=health_consent,
        gmfcs=gmfcs,
        restrictions=frozenset(restrictions),
        surgery=surgery,
        goals=goals,
        minutes=minutes,
        start_level=start_level,
        band=age_band(birth_date, start_date),
    )


def exclusion_reason(
    ex: LibraryExercise, facts: Facts, lang: str, tools: Collection[str], therapist: Therapist | None = None
) -> str | None:
    """Why an exercise can never be used for this child, or None when it is safe (spec §13 step 2)."""
    if not facts.exercises_allowed:
        return "no_health_consent"
    if lang not in ex.approved:
        return "not_approved"  # product rule 3: a physiotherapist approves every video first
    if facts.restrictions.intersection(ex.conflicts):
        return "restriction"
    if ex.body_area in facts.surgery:
        return "surgery"
    if (facts.gmfcs or 5) not in ex.gmfcs:
        return "movement_level"
    if facts.band not in ex.ages:
        return "age"
    if ex.tool and ex.tool not in tools:
        return "tool"
    if therapist and ex.id in therapist.exclude:
        return "therapist_excluded"
    return None
