"""IQ3: the CEO's questionnaire answers, read as the P1-P41 answers the plan, the skill model and the assistant use.

`p_view` turns a round of the new questionnaire into P answers (C10 -> P12, J9 -> P33, D4 -> P23 ...) and adds the
questionnaire's red flags (its table "Red flags: stop or hold the roadmap", plus the CTO package's launch rules):

- `_hold`: reasons to give no exercises at all (games only): the parent sees a doctor first, or autism only. No plan
  waits for a therapist (A4.8): the next round asks again and builds the full plan once the answer has changed;
- `_restrictions`: restriction tags (plans/safety.py) the answers add.

What the questionnaire does not ask stays unanswered, and unanswered is the cautious choice (product rule 2). It has
no "a doctor said your child must not..." list (P14): until a therapist sets restrictions (IQ6), every listed
restriction applies. ponytail: these mappings are the team's reading, listed under IQ3 in TASKS.md for the therapist.
"""

from datetime import date, timedelta
from typing import Any

RECENT = timedelta(days=183)  # "surgery, cast or Botox in the last 6 months" (P15), the questionnaire's "recent"
GMFCS_P12 = {"i": "walks", "ii": "walks_help", "iii": "walker", "iv": "wheelchair", "v": "needs_help_sit"}
GOALS = {"sit": ["sit"], "stand": ["walk"], "walk": ["walk"], "hands_eat": ["eat", "hands"], "hold": ["hands"],
         "communicate": ["communicate"], "tablet": ["understand"], "school": ["school"]}  # fmt: skip
SURGERY_PART = {"hip": ["legs"], "tendon": ["legs"], "spine": ["trunk"], "shunt": ["head_neck"],
                "other": ["legs", "arms", "hands", "trunk", "head_neck"]}  # fmt: skip
BODY_PART = {"head_neck": "head_neck", "shoulders": "arms", "back": "trunk", "hips": "legs", "left_arm": "arms",
             "right_arm": "arms", "left_hand": "hands", "right_hand": "hands", "left_leg": "legs", "right_leg": "legs",
             "left_foot": "legs", "right_foot": "legs"}  # fmt: skip


def _list(v: Any) -> list[Any]:
    return v if isinstance(v, list) else []


def _ability(v: Any, scale: dict[str, int]) -> int | None:
    return scale.get(v) if isinstance(v, str) else None


def _recent(when: Any, today: date) -> bool:
    """A date in the last 6 months; "Not sure" (no date) counts as recent."""
    try:
        return today - date.fromisoformat(when) <= RECENT
    except (TypeError, ValueError):
        return True


def _movement(a: dict[str, Any]) -> str | None:
    """P12 from the GMFCS picture, or for children without it (DCD, delay...) from the walking and sitting steps."""
    if isinstance(a.get("C10"), str):
        return GMFCS_P12[a["C10"]]
    walk, sit = a.get("C6"), a.get("C3")
    if walk == "alone_7m":
        return "walks"
    if walk in ("alone_few_m", "one_hand"):
        return "walks_help"
    if walk in ("walker_two_hands", "adult_trunk"):
        return "walker"
    if walk in ("doesnt_step", "gait_trainer"):
        return "needs_help_sit" if sit == "cant_sit" else "wheelchair"
    return None  # not answered: the cautious level (plans/safety.py)


def p_view(a: dict[str, Any], today: date) -> dict[str, Any]:
    """The P answers the rules read, with `_hold` and `_restrictions` (see the module docstring)."""
    dx = set(_list(a.get("B1")))
    p: dict[str, Any] = {"P1": a.get("A1"), "P2": a.get("A2"), "P3": a.get("A3")}
    p["P9"] = sorted(
        {"cp": "cp", "autism": "autism", "down_syndrome": "down", "dcd": "other", "developmental_delay": "other",
         "other": "other", "no_diagnosis": "not_diagnosed", "not_sure": "not_diagnosed"}[d]
        for d in dx
    ) or None  # fmt: skip
    p["P10"] = a.get("CP1")
    p["P11"] = {"one_side": "one_side", "legs": "legs", "three_limbs": "whole_body", "whole_body": "whole_body"}.get(
        a.get("CP2")  # type: ignore[arg-type]
    )
    p["P12"] = _movement(a)
    p["P13"] = {"no": "never", "controlled": "last_year", "still": "last_year"}.get(a.get("B6"))  # type: ignore[arg-type]
    p["P14"] = None  # not asked: every listed restriction until a therapist sets them (IQ6)
    surgery = a.get("B8") == "yes" and _recent(a.get("B8_date"), today)
    botox = a.get("CP3") == "yes" and _recent(a.get("CP3_date"), today)
    parts = {part for t in _list(a.get("B8_type")) for part in SURGERY_PART.get(t, [])} if surgery else set()
    if botox:
        parts |= {BODY_PART[m] for m in _list(a.get("CP3_muscles")) if m in BODY_PART} or {"legs"}
    known = a.get("B8") in ("yes", "no") and (a.get("CP3") in ("yes", "no") or "cp" not in dx)  # Botox: CP only
    p["P15"] = "yes" if surgery or botox else "no" if known else None  # "no" also when it was over 6 months ago
    p["P15_part"] = sorted(parts) or None
    p["P17"] = {"never": "no", "sometimes": "yes", "often": "yes", "tube_fed": "yes"}.get(a.get("E10"))  # type: ignore[arg-type]
    p["P18"] = _ability(a.get("F1"), {"yes": 2, "gesture": 1, "no": 0})
    p["P19"] = _ability(a.get("F2"), {"yes": 2, "sometimes": 1, "no": 0})
    talk = set(_list(a.get("G1")))
    p["P20"] = 2 if talk & {"sentences", "single_words"} else 1 if "sounds_gestures" in talk else 0 if talk else None
    p["P21"] = 2 if "sentences" in talk else 1 if "single_words" in talk else 0 if talk else None
    p["P23"] = _ability(a.get("D4"), {"thumb_finger": 2, "whole_hand": 1, "cannot": 0})
    p["P24"] = _ability(a.get("D12"), {"yes": 2, "with_help": 1, "no": 0})
    if p["P24"] is None:
        p["P24"] = _ability(a.get("D11"), {"fingers": 2, "fist": 1, "cant": 0})
    p["P26"] = _ability(a.get("D7"), {"accurately": 2, "big_only": 1, "with_help": 1, "not_yet": 0})
    p["P27"] = _ability(a.get("C3"), {"free_30min": 2, "free_few_min": 2, "hands_5min": 1, "hands_under_10s": 1,
                                       "cant_sit": 0})  # fmt: skip
    p["P29"] = _ability(a.get("F6"), {"normal": 2, "hearing_aid": 1, "hard": 1, "deaf": 0})
    p["P30"] = _ability(a.get("F4"), {"over_15": 2, "5_15": 2, "1_5": 1, "under_1": 0})
    p["P31"] = _ability(a.get("H1"), {"self": 2, "some_help": 1, "i_feed": 0, "tube": 0})
    p["P32"] = _ability(a.get("H2"), {"alone": 2, "helps": 1, "no": 0})
    p["P33"] = list(dict.fromkeys(g for goal in _list(a.get("J9")) for g in GOALS.get(goal, [])))[:3] or None
    p["P34"] = {"10": "10", "20": "20", "30": "30", "45": "30"}.get(a.get("J1"))  # type: ignore[arg-type]
    p["P35"] = {"morning": "morning", "midday": "afternoon", "afternoon": "afternoon", "evening": "evening"}.get(
        a.get("H5")  # type: ignore[arg-type]
    )
    p["P37"] = [
        i for i in _list(a.get("F9")) if i in ("music", "cars", "animals", "cartoons", "water", "balls")
    ] or None

    hold: list[str] = []
    restrictions: set[str] = set()
    if a.get("C12") == "yes":
        hold.append("lost_skill")  # "No roadmap. Tell parent to see a doctor soon."
    if surgery or botox:
        hold.append("recent_surgery_or_botox")  # see the doctor; ends 6 months after the date, or with a therapist's T6
    if a.get("B6") == "still":
        hold.append("seizures")
    if a.get("DS2") == "yes" or "heart" in _list(a.get("B7")):
        hold.append("heart")
    if dx == {"autism"}:
        hold.append("autism_only")  # CTO package R21, founders 22 Oct: games and My Voice only
    if a.get("DS1") != "normal" and "down_syndrome" in dx:  # Down syndrome: an AI plan with these restrictions (A4.8)
        restrictions |= {"neck_flexion", "prone"}  # "No neck-bending, rolling or head-down until a doctor clears it"
    if a.get("E7") != "no" or "shunt" in _list(a.get("B7")) or a.get("E13") != "no":
        restrictions.add("high_intensity")  # weak bones, shunt or implant (or "Not sure"): therapist reviews first
    if "shunt" in _list(a.get("B7")) or a.get("E13") == "yes":
        restrictions |= {"prone", "neck_flexion"}  # positions are the therapist's to review
    if a.get("DD4") != "no" and not dx & {"cp"} and dx & {"developmental_delay", "no_diagnosis", "not_sure", "other"}:
        restrictions |= {"leg_balance", "high_intensity"}  # one side weaker without a diagnosis: basic roadmap only
    pain = set(_list(a.get("E4"))) if a.get("E3") in ("sometimes", "often") else set()
    bones = set(_list(a.get("E7_where"))) if a.get("E7") == "yes" else set()
    painful = {BODY_PART[x] for x in pain | bones if x in BODY_PART}
    if a.get("E3") == "often" and not pain:
        restrictions.add("high_intensity")  # frequent pain, nowhere marked: no hard exercise (A4.8)
    if painful:
        p["P15_part"] = sorted(set(p["P15_part"] or []) | painful)  # the plan leaves these body areas out
        p["P15"] = "yes"
    p["_hold"] = hold
    p["_restrictions"] = sorted(restrictions)
    return {k: v for k, v in p.items() if v is not None or k == "P14"}


def rules_view(questionnaire: str, answers: dict[str, Any], today: date) -> dict[str, Any]:
    """A round's answers as the rules read them: P1-P41 rounds as they are, the CEO's questionnaire through p_view."""
    return answers if questionnaire == "p41" else p_view(answers, today)
