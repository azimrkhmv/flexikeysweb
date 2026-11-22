"""manual_payments: payments the team took by hand (B114)

Revision ID: 0046
Revises: 0045
Create Date: 2026-11-22 23:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0046"
down_revision: str | Sequence[str] | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "manual_payments",
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("amount_uzs", sa.BigInteger(), nullable=False),
        sa.Column("method", sa.String(length=40), nullable=False),
        sa.Column("paid_until", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=300), nullable=False),
        sa.Column("recorded_by", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["family_id"], ["families.id"], name=op.f("fk_manual_payments_family_id_families"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"], ["users.id"], name=op.f("fk_manual_payments_recorded_by_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_manual_payments")),
    )
    op.create_index(op.f("ix_manual_payments_family_id"), "manual_payments", ["family_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_manual_payments_family_id"), table_name="manual_payments")
    op.drop_table("manual_payments")
