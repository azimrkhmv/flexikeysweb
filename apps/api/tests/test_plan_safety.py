"""A4.2: the safety filter. Every restriction, seizure, surgery and movement-level combination, against the whole
exercise library: an exercise passes exactly when none of the rules, written out again here, forbids it."""

import itertools
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.modules.plans.safety import Facts, LibraryExercise, Therapist, age_band, exclusion_reason, plan_facts

RAW = json.loads((Path(__file__).parents[1] / "app" / "content" / "exercises.json").read_text("utf-8"))
TOOLS = tuple(RAW["kit_tools"])
LIB = [
    LibraryExercise(
        id=e["id"],
        body_area=e["body_area"],
        goals=tuple(e["goals"]),
        gmfcs=tuple(e["gmfcs"]),
        ages=tuple(e["ages"]),
        tool=e["tool"],
        difficulty=e["difficulty"],
        conflicts=tuple(e["conflicts"]),
        approved=frozenset({"uz", "ru", "en"}),
    )
    for e in RAW["exercises"]
]
BASE: dict[str, Any] = {
    "P9": ["speech_delay"], "P12": "walks", "P13": "never", "P14": ["nothing"], "P15": "no", "P17": "no",
    "P20": 1, "P21": 1, "P23": 2, "P24": 2, "P26": 2, "P33": ["walk", "hands", "communicate"], "P34": "20",
}  # fmt: skip
BIRTH, START = date(2019, 5, 1), date(2026, 10, 12)
THERAPIST = Therapist(
    restrictions=frozenset({"jumping", "standing"}),
    goals=("sit",),
    assign=frozenset({"bunny_hops", "sit_to_stand"}),
    exclude=frozenset({"putty_squeeze"}),
    leg_balance_approved=True,
    gmfcs=2,
)
P12_GMFCS = {"walks": 1, "walks_help": 2, "walker": 3, "wheelchair": 4, "needs_help_sit": 5}
NOT_ANSWERED = object()  # the key is left out


def facts(answers: dict[str, Any], *, health: bool = True, therapist: Therapist | None = None) -> Facts:
    return plan_facts(answers, birth_date=BIRTH, start_date=START, health_consent=health, therapist=therapist)


COMBINATIONS = list(
    itertools.product(
        ["walks", "walks_help", "walker", "wheelchair", "needs_help_sit", None, NOT_ANSWERED],  # P12 movement
        ["last_year", "earlier", "never", None, NOT_ANSWERED],  # P13 seizures
        [["nothing"], ["jumping"], ["prone", "neck_flexion"], ["single_leg_weight"], None, NOT_ANSWERED],  # P14
        [("no", None), ("yes", ["legs"]), ("yes", ["hands", "trunk"]), (None, None), (NOT_ANSWERED, None)],  # P15
        [["cp"], ["autism"]],  # P9
        [None, THERAPIST],
    )
)


def test_every_combination_against_every_exercise() -> None:
    for p12, p13, p14, (p15, part), p9, th in COMBINATIONS:
        given = {"P9": p9, "P12": p12, "P13": p13, "P14": p14, "P15": p15, "P15_part": part}
        answers = {k: v for k, v in (BASE | given).items() if v is not NOT_ANSWERED}
        f = facts(answers, therapist=th)

        gmfcs = th.gmfcs if th else P12_GMFCS.get(p12) if isinstance(p12, str) else None
        banned = set(th.restrictions if th else ())
        banned |= (
            set(p14) - {"nothing"}
            if isinstance(p14, list)
            else {"jumping", "prone", "neck_flexion", "single_leg_weight"}
        )
        if p13 not in ("never", "earlier") or p15 not in ("no", "yes"):
            banned.add("high_intensity")
        if gmfcs is None or gmfcs >= 4:
            banned |= {"standing", "walking"}
        if "cp" in p9 and not th:
            banned.add("leg_balance")
        operated = set(part) if p15 == "yes" and part else set()
        assert (f.gmfcs, f.restrictions, f.surgery) == (gmfcs, frozenset(banned), frozenset(operated)), (
            given,
            bool(th),
        )

        for ex in LIB:
            safe = (
                not banned.intersection(ex.conflicts)
                and ex.body_area not in operated
                and (gmfcs or 5) in ex.gmfcs
                and not (th and ex.id in th.exclude)
            )
            why = exclusion_reason(ex, f, "uz", TOOLS, th)
            assert (why is None) == safe, (given, bool(th), ex.id, why)
    assert len(COMBINATIONS) == 7 * 5 * 6 * 5 * 2 * 2


def test_cautious_readings() -> None:
    f = facts({})  # nothing answered
    assert f.restrictions == {
        "jumping", "prone", "neck_flexion", "single_leg_weight", "standing", "walking", "high_intensity", "mouth_face"
    }  # fmt: skip
    assert (f.gmfcs, f.minutes, f.goals) == (None, 10, ("hands", "sit", "communicate"))
    assert set(f.start_level.values()) == {1}
    assert "mouth_face" in facts(BASE | {"P17": "sometimes"}).restrictions
    assert "mouth_face" not in facts(BASE).restrictions


def test_without_health_consent_no_exercise_and_no_movement_level() -> None:
    f = facts(BASE, health=False)
    assert f.gmfcs is None  # P12 is health data: not used without the consent
    assert all(exclusion_reason(ex, f, "uz", TOOLS) == "no_health_consent" for ex in LIB)


def test_therapist_wins() -> None:
    f = facts(BASE | {"P12": "wheelchair", "P9": ["cp"]}, therapist=THERAPIST)
    assert f.gmfcs == 2 and f.goals == ("sit",)
    assert "leg_balance" not in f.restrictions and {"jumping", "standing"} <= f.restrictions
    putty = next(ex for ex in LIB if ex.id == "putty_squeeze")
    assert exclusion_reason(putty, f, "uz", TOOLS, THERAPIST) == "therapist_excluded"


def test_other_reasons() -> None:
    f = facts(BASE)
    ex = next(ex for ex in LIB if ex.tool and exclusion_reason(ex, f, "uz", TOOLS) is None)
    assert exclusion_reason(ex, f, "uz", [t for t in TOOLS if t != ex.tool]) == "tool"
    unapproved = LibraryExercise(**{**ex.__dict__, "approved": frozenset({"ru"})})
    assert exclusion_reason(unapproved, f, "uz", TOOLS) == "not_approved"
    young = LibraryExercise(**{**ex.__dict__, "ages": ("2-4",)})
    assert exclusion_reason(young, f, "uz", TOOLS) == "age"


@pytest.mark.parametrize(
    ("birth", "band"),
    [
        (date(2021, 10, 12), "5-8"),  # 5 today
        (date(2021, 10, 13), "2-4"),  # 5 tomorrow
        (date(2017, 10, 13), "5-8"),
        (date(2014, 10, 12), "9-12"),
        (date(2013, 10, 12), "13-20"),
    ],
)
def test_age_band(birth: date, band: str) -> None:
    assert age_band(birth, START) == band


def test_start_levels() -> None:
    f = facts(BASE | {"P12": "walker", "P20": 0, "P21": None, "P23": 1, "P24": 2})
    assert dict(f.start_level) == {"hands": 2, "arms": 2, "legs": 2, "trunk": 2, "head_neck": 2, "mouth_face": 1}
