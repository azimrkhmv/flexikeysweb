"""The AI chooses the plan, inside what the rules allow (A4.6; founders, 2026-10-22: "the AI chooses, but only inside
the safe list the rules allow").

1. The rules first decide what this child may get: the approved, safe exercises at the child's level
   (engine.allowed_exercises) and FlexiKeys' fixed set of games (engine.GAMES).
2. The AI finds the research entries for this child (assistant/research.py), and gets only those.
3. It picks exercises and games from the two lists only, and every pick must cite one of the given entries.
4. Code checks every pick: one not on the lists, or without a given source, is dropped. The engine still lays out
   the 28 days. No usable pick, no library, the AI off or not answering: None, and the rules plan is used.

The AI gets the child's age, condition groups, movement level, goals and daily minutes: never a name, a birth date or
free text. It is off unless AI_PLAN is set (G7: the lawyer on sending health data abroad; E2: the model).
"""

import json
import logging
from collections.abc import Collection, Mapping
from datetime import date
from decimal import Decimal
from typing import Any

from app.errors import AppError
from app.modules.assistant import research
from app.modules.assistant.ai import Ai, AiReply
from app.modules.plans import engine
from app.modules.plans.safety import Facts, LibraryExercise, Therapist, plan_facts
from app.settings import settings

log = logging.getLogger("app.ai")
MAX_EXERCISES, MAX_GAMES = 8, 4
CONDITIONS = {"cp": "cerebral palsy", "autism": "autism", "down": "Down syndrome", "speech_delay": "speech delay",
              "adhd": "ADHD", "other": "coordination disorder, developmental delay or another condition",
              "not_diagnosed": "no diagnosis yet"}  # fmt: skip


def condition_words(answers: Mapping[str, Any]) -> str:
    """The child's condition groups in words (P9, or the questionnaire's B1 through the bridge); "not known"."""
    p9 = answers.get("P9")
    return ", ".join(dict.fromkeys(CONDITIONS.get(c, "another condition") for c in p9)) if p9 else "not known"


def _child(answers: Mapping[str, Any], birth_date: date, start: date, f: Facts) -> str:
    age = start.year - birth_date.year - ((start.month, start.day) < (birth_date.month, birth_date.day))
    conditions = condition_words(answers)
    level = f"GMFCS level {f.gmfcs}" if f.gmfcs else "movement level not known"
    return (
        f"A child of {age} years; condition: {conditions}; {level}; goals: {', '.join(f.goals)}; "
        f"{f.minutes} minutes a day at home."
    )


def _picks(raw: Any, allowed: Collection[str], given: Collection[str], most: int) -> tuple[tuple[str, str], ...]:
    """(id, source) for each pick on the list that cites a given entry; anything else is dropped."""
    out: dict[str, str] = {}
    for p in raw if isinstance(raw, list) else []:
        if isinstance(p, dict) and p.get("id") in allowed and p.get("source") in given:
            out.setdefault(p["id"], p["source"])
    return tuple(out.items())[:most]


async def choose(
    ai: Ai,
    answers: Mapping[str, Any],
    library: list[LibraryExercise],
    titles: Mapping[str, str],
    *,
    birth_date: date,
    start_date: date,
    lang: str,
    health_consent: bool,
    therapist: Therapist | None,
    tools: Collection[str] = engine.KIT_TOOLS,
) -> tuple[engine.Choice | None, list[AiReply], dict[str, str]]:
    """The AI's choice (or None), the AI calls made (for their cost) and each cited entry's papers, for the reasons."""
    entries = research.library(settings.research_path)
    if not settings.ai_plan or not entries:
        return None, [], {}
    f = plan_facts(
        answers, birth_date=birth_date, start_date=start_date, health_consent=health_consent, therapist=therapist
    )
    exercises = engine.allowed_exercises(f, library, lang, tools, therapist)
    child = _child(answers, birth_date, start_date, f)
    calls: list[AiReply] = []
    try:
        calls.append(
            await ai.chat(research.pick_prompt(entries, f"Which home exercises and games suit this child? {child}"))
        )
        chosen, _ = research.picked(calls[0].text, entries)
        if not chosen:
            return None, calls, {}
        lists = "\n".join(
            [f"- {ex.id}: {titles.get(ex.id, ex.id)} (body area {ex.body_area}, goals {', '.join(ex.goals)})"
             for ex in exercises] or ["(none: games only for now)"]
        )  # fmt: skip
        games = "\n".join(
            f"- {g}: helps {', '.join(k for k, v in engine.GOAL_GAMES.items() if g in v)}" for g in engine.GAMES
        )
        system = (
            "You choose a child's 4-week home plan for FlexiKeys. Choose ONLY from the two lists below, and ONLY on "
            "the basis of the research passages below, never from your own knowledge. Every choice must cite the ID "
            f'of the passage it rests on. Reply with JSON only: {{"exercises": [up to {MAX_EXERCISES} of '
            '{"id": exercise id, "source": passage ID}, best first], "games": [up to '
            f'{MAX_GAMES} of {{"id": game id, "source": passage ID}}, best first]}}. Leave out what no passage '
            f"supports.\n\nThe child: {child}\n\nExercises (approved and safe for this child):\n{lists}\n\nGames:\n"
            f"{games}\n\n{research.passages(chosen)}"
        )
        calls.append(await ai.chat([{"role": "system", "content": system}, {"role": "user", "content": child}]))
        text = calls[1].text
        data = json.loads(text[text.index("{") : text.rindex("}") + 1])
    except AppError:  # the AI did not answer: the rules plan
        return None, calls, {}
    except (ValueError, AttributeError):
        log.warning("AI plan: not a JSON answer")
        return None, calls, {}
    given = {e.id for e in chosen}
    choice = engine.Choice(
        exercises=_picks(data.get("exercises"), {ex.id for ex in exercises}, given, MAX_EXERCISES),
        games=_picks(data.get("games"), engine.GAMES, given, MAX_GAMES),
    )
    if not choice.exercises and not choice.games:
        return None, calls, {}
    return choice, calls, {e.id: "; ".join(e.sources) for e in chosen}


def cost(calls: list[AiReply]) -> tuple[int, int, Decimal]:
    return (
        sum(c.input_tokens for c in calls),
        sum(c.output_tokens for c in calls),
        sum((c.cost_usd for c in calls), Decimal(0)),
    )
