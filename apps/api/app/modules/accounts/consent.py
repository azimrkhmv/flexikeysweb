"""The basic consent a person gives at sign-up, in the 4 interface languages.

DRAFT: the wording is the website's current text (apps/web/src/messages/auth.ts "auth.details.consent").
The final texts come from the founders and the lawyer (TASKS.md G6). When they change, raise VERSION:
everyone is then asked to agree again.
"""

from app.modules.accounts.models import Lang

VERSION = "2026-09-v1"  # same as the website's CONSENT_VERSION (apps/web/src/lib/api/schema.ts)

TEXTS: dict[Lang, tuple[str, str]] = {
    Lang.en: (
        "I agree to FlexiKeys storing my account and my child's play data",
        "Needed to use the app. We never sell or share data, and you can delete everything at any time.",
    ),
    Lang.uz: (
        "FlexiKeys hisobim va bolamning oʻyin maʼlumotlarini saqlashiga roziman",
        "Ilovadan foydalanish uchun kerak. Maʼlumotlarni hech qachon sotmaymiz va bermaymiz, "
        "ularni istalgan vaqtda oʻchirishingiz mumkin.",
    ),
    Lang.uz_cyrl: (
        "FlexiKeys ҳисобим ва боламнинг ўйин маълумотларини сақлашига розиман",
        "Иловадан фойдаланиш учун керак. Маълумотларни ҳеч қачон сотмаймиз ва бермаймиз, "
        "уларни исталган вақтда ўчиришингиз мумкин.",
    ),
    Lang.ru: (
        "Я согласен(на), что FlexiKeys хранит мой аккаунт и данные игр ребёнка",
        "Нужно для работы приложения. Мы никогда не продаём и не передаём данные, удалить всё можно в любой момент.",
    ),
}
