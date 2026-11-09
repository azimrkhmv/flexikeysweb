"""skill areas reasoning and speed; tries record the tier and step played (games spec 8 Nov 2026, B80)

Revision ID: 0041
Revises: 0040
Create Date: 2026-11-09 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0041"
down_revision: str | Sequence[str] | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = ("access", "attention", "memory", "flexibility", "literacy", "numeracy")
NEW = ("access", "attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed")


def _areas(values: tuple[str, ...]) -> None:
    # The area column's Enum check (native_enum=False) lists the allowed values; autogenerate doesn't see changes.
    op.drop_constraint(op.f("ck_skill_levels_skillarea"), "skill_levels", type_="check")
    op.create_check_constraint(op.f("ck_skill_levels_skillarea"), "skill_levels", f"area IN {values!r}")


def upgrade() -> None:
    """Upgrade schema."""
    _areas(NEW)
    # Nullable: old tries keep only their world level. On the partitioned parent, so every month gets them.
    op.add_column("tries", sa.Column("tier", sa.SmallInteger(), nullable=True))
    op.add_column("tries", sa.Column("step", sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("tries", "step")
    op.drop_column("tries", "tier")
    op.execute("DELETE FROM skill_levels WHERE area IN ('reasoning', 'speed')")
    _areas(OLD)
