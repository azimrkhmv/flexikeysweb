"""skill_snapshot: each skill area's θ once a week, for the progress panel (games spec 8 Nov 2026 §8.2, B89)

Revision ID: 0043
Revises: 0042
Create Date: 2026-11-12 23:55:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0043"
down_revision: str | Sequence[str] | None = "0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AREAS = ("access", "attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed")


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "skill_snapshot",
        sa.Column("child_id", sa.Uuid(), nullable=False),
        sa.Column(
            "area",
            sa.Enum(*AREAS, name="skillarea", native_enum=False, create_constraint=True, length=16),
            nullable=False,
        ),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("theta", sa.Float(), nullable=False),
        sa.Column("n_trials", sa.Integer(), nullable=False),
        sa.Column("top_activity_id", sa.String(length=64), nullable=True),
        sa.Column("top_tier", sa.SmallInteger(), nullable=True),
        sa.Column("top_step", sa.SmallInteger(), nullable=True),
        sa.CheckConstraint("top_tier between 1 and 4", name=op.f("ck_skill_snapshot_top_tier")),
        sa.CheckConstraint("top_step between 1 and 3", name=op.f("ck_skill_snapshot_top_step")),
        sa.ForeignKeyConstraint(
            ["child_id"], ["children.id"], name=op.f("fk_skill_snapshot_child_id_children"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("child_id", "area", "week_start", name=op.f("pk_skill_snapshot")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("skill_snapshot")
