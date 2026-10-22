"""The research library (A9.8): the assistant answers only from the team's knowledge base, never from the AI's own
knowledge, and every answer names the papers it came from.

The knowledge base is the CEO's "FlexiKeys Knowledge Base" (Markdown; entries `### KB-HAND-02 — Title` with
**Tags:**, **For families:**, **Clinical notes:** and **Evidence:** [S1], and a Sources table). It is kept outside
the repository; RESEARCH_PATH points at the file, or at a folder of such files. Without it the library is off.

For each question the AI first picks at most 3 entries from the list of entry titles (it reads any language, the
entries are English); the server then gives the AI only those entries. The answer must cite them as [KB-…]; the
server checks the citations, takes the codes out and adds the papers' names. No entry and no question about the
child's own plan: the fixed "I don't know" answer, with no second AI call.
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.modules.accounts.models import Lang

MAX_ENTRIES = 3
# Not for families now: home massage is a later feature (founders, 2026-10-22; FA7: its section and its rule), and the
# draft exercise cards are not approved (only the approved exercise library is suggested).
LEFT_OUT = ("KB-MAS-", "KB-CONF-05", "KB-EX-")
_ENTRY = re.compile(r"^### (KB-[A-Z]+-\d+) — (.+)$", re.M)
_FIELD = re.compile(r"^\*\*([^*\n]+):\*\*", re.M)  # **Tags:**, **For families:**, **FlexiKeys rule:** ...
_SOURCE = re.compile(r"^\| (S\d+) \| (.+?) — \[?([^\]|]+)\]?(?:\([^)]*\))?.*?\| (\d{4}|[^|]+?) \|", re.M)
_CITED = re.compile(r"\[(KB-[A-Z]+-\d+)\]")

NO_SOURCE = {
    Lang.en: "I don't know: our research library has nothing on this. Please ask your child's therapist.",
    Lang.ru: "Не знаю: в нашей библиотеке исследований об этом ничего нет. Спросите, пожалуйста, специалиста, "
    "который занимается с ребёнком.",
    Lang.uz: "Bilmayman: tadqiqotlar kutubxonamizda bu haqda maʼlumot yoʻq. Iltimos, farzandingizning terapevtidan "
    "soʻrang.",
}
TEAM_NOTE = "FlexiKeys knowledge base, team note"
SOURCE_WORD = {Lang.en: "Source", Lang.ru: "Источник", Lang.uz: "Manba"}


@dataclass(frozen=True)
class Entry:
    id: str
    title: str
    tags: str
    families: str
    clinical: str
    sources: tuple[str, ...]  # "Novak et al., 2020"


def _fields(body: str) -> dict[str, str]:
    parts = _FIELD.split(body)
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}


def parse(text: str) -> dict[str, Entry]:
    """Every entry of one knowledge-base file, by ID. Sections use different fields ("What the sources say",
    "FlexiKeys rule", tables...): everything but the tags, the clinical notes and the evidence is the text for
    families. The papers are every [S…] the entry cites; with none, the evidence line itself (a team protocol)."""
    names = {s: f"{who.strip()}, {year.strip()}" for s, who, _, year in _SOURCE.findall(text)}
    heads = list(_ENTRY.finditer(text))
    entries = {}
    for k, head in enumerate(heads):
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        body = re.split(r"^## ", text[head.end() : end], maxsplit=1, flags=re.M)[0]
        f = _fields(body)
        tags, _, rest = f.pop("Tags", "").partition("\n")
        clinical, evidence = f.pop("Clinical notes", ""), f.pop("Evidence", "")
        families = f.pop("For families", "")
        lead = _FIELD.split(body)[0].strip()  # an entry written as plain text or a list, without fields
        families = "\n\n".join(x for x in [lead, families, rest.strip(), *(f"{k}: {v}" for k, v in f.items())] if x)
        cited = [names[s] for s in dict.fromkeys(re.findall(r"S\d+", body)) if s in names]
        entries[head[1]] = Entry(
            id=head[1], title=head[2].strip(), tags=tags.strip(), families=families, clinical=clinical,
            sources=tuple(cited) or (evidence.replace("\\", "") or TEAM_NOTE,),
        )  # fmt: skip
    return entries


@lru_cache
def library(path: str) -> dict[str, Entry]:
    """The entries the assistant may use (read once). An empty path: no library."""
    if not path:
        return {}
    p = Path(path).expanduser()
    files = sorted(p.glob("*.md")) if p.is_dir() else [p]
    found = {k: v for f in files for k, v in parse(f.read_text("utf-8")).items()}
    return {k: v for k, v in found.items() if not k.startswith(LEFT_OUT)}


def for_asker(entries: dict[str, Entry], therapist: bool) -> dict[str, Entry]:
    """Entries tagged "not for parents" are for therapists only."""
    return entries if therapist else {k: e for k, e in entries.items() if "not for parents" not in e.tags}


def pick_prompt(entries: dict[str, Entry], question: str) -> list[dict[str, str]]:
    index = "\n".join(f"{e.id} — {e.title} ({e.tags})" for e in entries.values())
    return [
        {
            "role": "system",
            "content": "You find knowledge-base entries for a question from a parent or a therapist of a child in "
            f"home therapy. Entries:\n{index}\n\nReply with JSON only: "
            '{"entries": [up to 3 entry IDs that answer the question, best first; [] if none does], '
            "\"plan\": true if the question is about the child's own plan, today's tasks or progress, else false}",
        },
        {"role": "user", "content": question},
    ]


def picked(reply: str, entries: dict[str, Entry]) -> tuple[list[Entry], bool]:
    """The entries the AI picked (only real ones, at most 3) and whether the question is about the child's plan."""
    try:
        data = json.loads(reply[reply.index("{") : reply.rindex("}") + 1])
        ids = [i for i in data.get("entries", []) if isinstance(i, str)]
        return [entries[i] for i in dict.fromkeys(ids) if i in entries][:MAX_ENTRIES], data.get("plan") is True
    except (ValueError, AttributeError):
        return [], False


def passages(chosen: list[Entry]) -> str:
    """The words added to the AI's instructions: only these entries, and how to use them."""
    if not chosen:
        return (
            "Answer only about the child's plan given above. Say you do not know anything else and suggest asking "
            "the child's therapist."
        )
    text = "\n\n".join(
        f"[{e.id}] {e.title}\nFor families: {e.families}\nClinical notes (for your reasoning, explain in plain "
        f"words): {e.clinical}"
        for e in chosen
    )
    return (
        "Answer ONLY from these research passages and the child's plan, never from your own knowledge. After each "
        "sentence that uses a passage, write its ID in square brackets, like [KB-HAND-02]. If the passages do not "
        f"answer the question, say you do not know and suggest asking the child's therapist.\n\n{text}"
    )


def with_sources(answer: str, chosen: list[Entry], plan: bool, lang: Lang) -> str | None:
    """The answer with the codes taken out and the papers named; None when it cites no passage it was given (and is
    not only about the child's plan)."""
    given = {e.id: e for e in chosen}
    cited = [given[i] for i in dict.fromkeys(_CITED.findall(answer)) if i in given]
    if not cited and not (plan and not _CITED.search(answer)):
        return None
    text = re.sub(r"\s*\[KB-[A-Z]+-\d+\]", "", answer).strip()
    names = list(dict.fromkeys(s for e in cited for s in e.sources))
    return f"{text}\n\n{SOURCE_WORD[lang]}: {'; '.join(names)}" if names else text
