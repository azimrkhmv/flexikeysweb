"""a round remembers which questionnaire it uses (IQ2)

Revision ID: 0037
Revises: 0036
Create Date: 2026-10-22 12:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0037"
down_revision: str | Sequence[str] | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "intake_rounds", sa.Column("questionnaire", sa.String(length=16), server_default="p41", nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("intake_rounds", "questionnaire")
