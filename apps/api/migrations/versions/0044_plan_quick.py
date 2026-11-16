"""plan_quick: a plan built from the quick start's answers, before the full questionnaire (B103)

Revision ID: 0044
Revises: 0043
Create Date: 2026-11-16 10:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0044"
down_revision: str | Sequence[str] | None = "0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable: every plan made so far stays as it is (null = from a finished questionnaire).
    op.add_column("plans", sa.Column("quick", sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("plans", "quick")
