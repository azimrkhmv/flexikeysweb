"""Assistant safety (A9.3, spec §12, product rule 2). Emergency words get the fixed 103 answer before any AI call;
an AI answer that mentions a movement the child must avoid is replaced by a fixed safe answer.

Words are matched in every language at once (parents mix languages), after lower-casing and writing every Uzbek
apostrophe as '. ponytail: word lists, so they can over-block (an answer saying "avoid walking" is replaced too);
a second AI check of the answer when this blocks good answers too often.
"""

import json
import re
from collections.abc import Iterable
from pathlib import Path

from app.modules.accounts.models import Lang

APOSTROPHES = str.maketrans({c: "'" for c in "ʻʼ‘’`"})


def _norm(text: str) -> str:
    return text.lower().translate(APOSTROPHES)


# Seizure, trouble breathing, a fall with a head injury, sudden strong pain (spec §12), and fainting.
EMERGENCY: list[str] = json.loads((Path(__file__).parents[2] / "content" / "emergency.json").read_text())["words"]
_EMERGENCY = re.compile("|".join(EMERGENCY))

EMERGENCY_ANSWER = {
    Lang.en: "Call 103 now. This can be an emergency: call an ambulance (103) or your doctor at once. Do not wait "
    "for an answer here.",
    Lang.ru: "Позвоните 103 сейчас. Это может быть срочно: вызовите скорую (103) или сразу позвоните врачу. Не ждите "
    "ответа здесь.",
    Lang.uz: "Hoziroq 103 ga qoʻngʻiroq qiling. Bu shoshilinch holat boʻlishi mumkin: tez yordam (103) chaqiring yoki "
    "darhol shifokoringizga qoʻngʻiroq qiling. Bu yerda javob kutmang.",
}

# The plan's restrictions (plans/safety.py), in plain words for the AI and as words to find in its answer.
RESTRICTIONS: dict[str, tuple[str, list[str]]] = {
    "jumping": ("jumping or hopping", [r"jump", r"\bhop(s|ping|ped)?\b", r"прыг", r"прыж", r"sakra", r"сакра"]),
    "prone": (
        "lying on the tummy",
        [r"tumm", r"on (his|her|their|the) stomach", r"face down", r"\bprone", r"на живот", r"qorni\w* bilan yot",
         r"qorni\w*ga yot", r"қорни\w* билан ёт", r"қорни\w*га ёт"],
    ),
    "neck_flexion": (
        "bending the head or neck forward",
        [r"chin to (the )?chest", r"bend\w* the (head|neck)", r"подбородок к груди", r"наклон\w* (головы|шеи)",
         r"iyagini ko'krak", r"boshini oldinga eg", r"иягини кўкрак", r"бошини олдинга эг"],
    ),
    "single_leg_weight": (
        "standing on one leg",
        [r"one (leg|foot)", r"на одной ноге", r"bir oyoq", r"бир оёқ"],
    ),
    "standing": ("standing", [r"\bstand", r"\bстоя", r"стоят", r"встат", r"встан", r"tik tur", r"turib", r"тик тур", r"туриб"]),
    "walking": ("walking", [r"\bwalk", r"ходьб", r"\bходит", r"yurish", r"yurib", r"юриш", r"юриб"]),
    "high_intensity": (
        "running or hard, fast exercise",
        [r"\brun", r"sprint", r"intens", r"\bбег", r"бежат", r"интенсив", r"yugur", r"югур"],
    ),
    "leg_balance": ("balance exercises on the legs", [r"balanc", r"баланс", r"равновеси", r"muvozanat", r"мувозанат"]),
    "mouth_face": (
        "mouth, lip or tongue exercises",
        [r"tongue", r"\blips?\b", r"\bblow", r"губ", r"языком", r"дуть", r"подуй", r"lablar", r"pufla",
         r"лаблар", r"пуфла"],
    ),
}  # fmt: skip

SAFE_ANSWER = {
    Lang.en: "I can't suggest that: your child's doctor or therapist said to avoid some movements, and my answer "
    "touched on them. Please ask your therapist, or look at today's task in the plan.",
    Lang.ru: "Я не могу это посоветовать: врач или терапевт ребёнка сказали избегать некоторых движений, а мой ответ их "
    "касался. Спросите терапевта или посмотрите сегодняшнее задание в плане.",
    Lang.uz: "Buni maslahat bera olmayman: farzandingizning shifokori yoki terapevti baʼzi harakatlardan saqlanishni "
    "aytgan, javobim ularga tegib ketdi. Terapevtingizdan soʻrang yoki rejadagi bugungi vazifani koʻring.",
}


# A9.6: the month's AI money is spent; the assistant still helps with fixed words.
RESTING_ANSWER = {
    Lang.en: "The assistant has used its time for this month. For an exercise, follow the video in today's task. For "
    "anything worrying call your doctor, and 103 in an emergency.",
    Lang.ru: "Ассистент исчерпал своё время на этот месяц. Для упражнения смотрите видео в сегодняшнем задании. Если "
    "что-то беспокоит, позвоните врачу, а в экстренном случае — 103.",
    Lang.uz: "Yordamchi bu oy uchun vaqtini tugatdi. Mashq uchun bugungi vazifadagi videoga qarang. Biror narsa "
    "tashvishlantirsa, shifokoringizga, shoshilinch holatda esa 103 ga qoʻngʻiroq qiling.",
}


def is_emergency(text: str) -> bool:
    return _EMERGENCY.search(_norm(text)) is not None


def avoid_words(restrictions: frozenset[str]) -> str:
    """The restrictions in plain words, for the AI's instructions."""
    return ", ".join(RESTRICTIONS[r][0] for r in sorted(restrictions) if r in RESTRICTIONS)


def breaks_restriction(answer: str, restrictions: frozenset[str]) -> str | None:
    """The first restriction the answer mentions, or None."""
    text = _norm(answer)
    return next((r for r in sorted(restrictions) if any(re.search(w, text) for w in RESTRICTIONS[r][1])), None)


def names_any(answer: str, titles: Iterable[str]) -> bool:
    """B30: the answer names one of these exercises (a title in any language)."""
    text = _norm(answer)
    return any(_norm(t) in text for t in titles)


# A9.4: what a question was about, for the therapist's summary (spec §12: topics and warnings, never the chat).
TOPICS: dict[str, list[str]] = json.loads((Path(__file__).parents[2] / "content" / "topics.json").read_text())["topics"]


def topics_of(text: str) -> list[str]:
    """Every topic the question touches; "other" when none."""
    t = _norm(text)
    return [k for k, words in TOPICS.items() if any(re.search(w, t) for w in words)] or ["other"]
