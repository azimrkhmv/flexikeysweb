"""center_links: partner centres' sign-up links, and the code each parent came through (B113)

Revision ID: 0045
Revises: 0044
Create Date: 2026-11-22 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0045"
down_revision: str | Sequence[str] | None = "0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "center_links",
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_center_links")),
        sa.UniqueConstraint("code", name=op.f("uq_center_links_code")),
    )
    # Nullable: every account made so far came without a centre link.
    op.add_column("users", sa.Column("ref_code", sa.String(length=32), nullable=True))
    op.create_index(op.f("ix_users_ref_code"), "users", ["ref_code"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_users_ref_code"), table_name="users")
    op.drop_column("users", "ref_code")
    op.drop_table("center_links")
