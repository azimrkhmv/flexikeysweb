"""The basic consent a person gives at sign-up: they agree to the Privacy policy (B112, 22 Nov 2026).

DRAFT: the wording is the website's current text (apps/web/src/messages/auth.ts "auth.details.consent"); the policy
is the website's /privacy page. The final texts come from the founders and the lawyer (TASKS.md G6, Q20). When the
policy changes, raise VERSION: the account then keeps which version the person agreed to, and when (users.consent_*).
"""

# ruff: noqa: RUF001  (Russian text: its one-letter words look like Latin letters to the linter)
from app.modules.accounts.models import Lang

# The Privacy policy's version (its date), the same as the website's PRIVACY_VERSION (apps/web/src/lib/api/schema.ts).
# Accounts made before 22 Nov 2026 keep "2026-09-v1", the old "store my account and play data" text.
VERSION = "2026-11-22"

TEXTS: dict[Lang, tuple[str, str]] = {
    Lang.en: (
        "I agree to the Privacy policy",
        "It says what FlexiKeys stores about you and your child, where, who can see it and for how long. "
        "Needed to use the app. You can delete everything at any time.",
    ),
    Lang.uz: (
        "Maxfiylik siyosatiga roziman",
        "Unda FlexiKeys siz va farzandingiz haqida nimani, qayerda saqlashi, uni kim koʻra olishi va qancha "
        "saqlashi yozilgan. Ilovadan foydalanish uchun kerak. Hammasini istalgan vaqtda oʻchirishingiz mumkin.",
    ),
    Lang.ru: (
        "Я согласен(на) с Политикой конфиденциальности",
        "В ней сказано, что FlexiKeys хранит о вас и ребёнке, где, кто это видит и как долго. "
        "Нужно для работы приложения. Удалить всё можно в любой момент.",
    ),
}
