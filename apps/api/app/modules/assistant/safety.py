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
         r"iyagini ko'?krak", r"boshini oldinga eg", r"иягини к[ўу]крак", r"бошини олдинга эг"],
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


# B92: the child's name in every form a parent writes it. Uzbek and Russian add endings to a name ("Alining",
# "Алига", "Мадины"), and parents write a Latin name in Cyrillic and the other way round.
# ponytail: letter tables and ending lists, so a name can be over-matched ("Alim" for Ali); a name is never let through.
_APOS = "['ʻʼ‘’`]?"
_CYRILLIC = re.compile("[а-яёўқғҳ]")
_TO_CYRILLIC = {
    "sh": "ш", "ch": "ч", "o'": "[ўоу]", "g'": "[ғг]", "yo": "ё", "yu": "ю", "ya": "я", "ye": "е", "ts": "ц",
    "a": "а", "b": "б", "d": "д", "e": "[еэ]", "f": "ф", "g": "г", "h": "[ҳх]", "i": "[ийы]", "j": "ж", "k": "к",
    "l": "ль?", "m": "м", "n": "н", "o": "[оа]", "p": "п", "q": "[қк]", "r": "р", "s": "с", "t": "т", "u": "у",
    "v": "в", "x": "х", "y": "[йи]", "z": "з", "'": "ъ?",
}  # fmt: skip
_TO_LATIN = {
    "ш": "sh", "ч": "ch", "ў": "o" + _APOS, "ғ": "g" + _APOS, "ё": "yo", "ю": "yu", "я": "ya", "ц": "ts",
    "а": "[ao]", "б": "b", "в": "v", "г": "g" + _APOS, "д": "d", "е": "(?:ye|e)", "э": "e", "ж": "j", "з": "z",
    "и": "i", "й": "y", "ы": "i", "к": "[kq]", "қ": "q", "л": "l", "м": "m", "н": "n", "о": "o" + _APOS, "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "(?:u|o" + _APOS + ")", "ф": "f", "х": "[xh]", "ҳ": "h", "ь": "", "ъ": _APOS,
}  # fmt: skip
_SAME_CYRILLIC = {c: f"[{pair}]" for pair in ("қк", "ғг", "ўу", "ҳх") for c in pair}
_LATIN_ENDING = "(?:jon|xon)?(?:m|im|ng|ing|si|i)?(?:ning|ni|ga|ka|qa|da|dan|niki|dagi)?"
_CYRILLIC_ENDING = "(?:жон|хон)?(?:м|им|нг|инг|си)?(?:нинг|ни|га|ка|да|дан|ники|даги)?"


def _spell(name: str, table: dict[str, str]) -> list[str]:
    """The name letter by letter in the other alphabet, each letter as the ways people write it."""
    out, i = [], 0
    while i < len(name):
        two = name[i : i + 2]
        key = two if two in table else name[i]
        out.append(table.get(key, re.escape(key)))
        i += len(key)
    return out


def name_pattern(name: str) -> re.Pattern[str]:
    """Finds the name in Latin and in Cyrillic letters, alone or with an Uzbek or Russian ending."""
    n = _norm(name.strip())
    if not n:
        return re.compile(r"(?!)")
    if _CYRILLIC.search(n):
        cyrillic = [_SAME_CYRILLIC.get(c, re.escape(c)) for c in n]
        latin = _spell(n, _TO_LATIN)
    else:
        latin = [_APOS if c == "'" else re.escape(c) for c in n]
        cyrillic = _spell(n, _TO_CYRILLIC)
    if cyrillic and any(re.fullmatch(cyrillic[-1], v) for v in "ая"):  # Мадина: Мадины, Мадине, Мадину, Мадиной
        russian = "".join(cyrillic[:-1]) + "[аяыеуюио](?:й|ю)?"
    else:  # Тимур: Тимура, Тимуру, Тимуром
        russian = "".join(cyrillic) + "(?:а|у|е|ом|ы|и|ой|я|ю|ем|ей)?"
    forms = ["".join(latin) + _LATIN_ENDING, russian + _CYRILLIC_ENDING]
    return re.compile(r"(?<!\w)(?:" + "|".join(forms) + r")(?!\w)", re.IGNORECASE)


# B93: the language the question is written in. Parents mix Uzbek and Russian and write both in either alphabet, so
# the answer follows the question, not the screen. ponytail: word lists; a question with none of the words keeps the
# screen's language. Uzbek in Cyrillic letters is Uzbek: the answer comes in Uzbek Latin, the app's Uzbek.
_LANGUAGES = json.loads((Path(__file__).parents[2] / "content" / "languages.json").read_text())
_WORDS = {key: frozenset(_LANGUAGES[key]) for key in ("uz", "uz_cyrillic", "ru_latin", "en")}
_WORD = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)*")
_UZBEK_CYRILLIC = re.compile("[ўқғҳ]")
_UZBEK_LATIN = re.compile("[og]'")


def answer_lang(text: str, screen: Lang) -> Lang:
    """The language most of the question's words are in; the screen's language when no word tells, or on a tie."""
    score = {Lang.uz: 0, Lang.ru: 0, Lang.en: 0}
    for word in _WORD.findall(_norm(text)):
        if _CYRILLIC.search(word):
            score[Lang.uz if word in _WORDS["uz_cyrillic"] or _UZBEK_CYRILLIC.search(word) else Lang.ru] += 1
        elif word in _WORDS["uz"] or _UZBEK_LATIN.search(word):
            score[Lang.uz] += 1
        elif word in _WORDS["ru_latin"]:
            score[Lang.ru] += 1
        elif word in _WORDS["en"]:
            score[Lang.en] += 1
    best = max(score.values())
    if best == 0 or score[screen] == best:
        return screen
    return next(lang for lang, n in score.items() if n == best)


# A9.4: what a question was about, for the therapist's summary (spec §12: topics and warnings, never the chat).
TOPICS: dict[str, list[str]] = json.loads((Path(__file__).parents[2] / "content" / "topics.json").read_text())["topics"]


def topics_of(text: str) -> list[str]:
    """Every topic the question touches; "other" when none."""
    t = _norm(text)
    return [k for k, words in TOPICS.items() if any(re.search(w, t) for w in words)] or ["other"]
