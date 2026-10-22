"""the AI chooses the plan inside the rules (A4.6): each reason keeps its research source; AI cost "plan"

Revision ID: 0039
Revises: 0038
Create Date: 2026-10-22 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0039"
down_revision: str | Sequence[str] | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PURPOSES = ("chat", "weekly_summary", "plan_explanation", "therapist_summary")


def _purposes(values: tuple[str, ...]) -> None:
    # The purpose column's Enum check (native_enum=False) lists the allowed values; autogenerate doesn't see changes.
    op.drop_constraint(op.f("ck_ai_usage_aipurpose"), "ai_usage", type_="check")
    op.create_check_constraint(op.f("ck_ai_usage_aipurpose"), "ai_usage", f"purpose IN {values!r}")


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("plan_reasons", sa.Column("source", sa.String(length=300), nullable=True))
    _purposes((*PURPOSES, "plan"))


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM ai_usage WHERE purpose = 'plan'")
    _purposes(PURPOSES)
    op.drop_column("plan_reasons", "source")
