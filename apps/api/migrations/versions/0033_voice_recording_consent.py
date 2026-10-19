"""voice recording consent (G8)

Revision ID: 0033
Revises: 0032
Create Date: 2026-10-19 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0033"
down_revision: str | Sequence[str] | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = ("health", "movement_videos", "therapist_share")
NEW = (*OLD, "voice_recording")


def _check(values: tuple[str, ...]) -> None:
    # The kind column's Enum check (native_enum=False) lists the allowed values; autogenerate doesn't see changes.
    op.drop_constraint(op.f("ck_child_consents_consentkind"), "child_consents", type_="check")
    op.create_check_constraint(op.f("ck_child_consents_consentkind"), "child_consents", f"kind IN {values!r}")


def upgrade() -> None:
    _check(NEW)


def downgrade() -> None:
    op.execute("DELETE FROM child_consents WHERE kind = 'voice_recording'")
    _check(OLD)
