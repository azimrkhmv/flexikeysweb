"""area_tier: the highest open tier of each skill area (games spec 8 Nov 2026 §3.2, B83)

Revision ID: 0042
Revises: 0041
Create Date: 2026-11-09 23:19:08.667399

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0042"
down_revision: str | Sequence[str] | None = "0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AREAS = ("access", "attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed")


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "area_tier",
        sa.Column("child_id", sa.Uuid(), nullable=False),
        sa.Column(
            "area",
            sa.Enum(*AREAS, name="skillarea", native_enum=False, create_constraint=True, length=16),
            nullable=False,
        ),
        sa.Column("top_tier", sa.SmallInteger(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("top_tier between 1 and 4", name=op.f("ck_area_tier_top_tier")),
        sa.ForeignKeyConstraint(
            ["child_id"], ["children.id"], name=op.f("fk_area_tier_child_id_children"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("child_id", "area", name=op.f("pk_area_tier")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("area_tier")
