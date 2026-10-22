"""no Uzbek Cyrillic: families on it move to Uzbek Latin (founders, 2026-10-22; FA3)

Revision ID: 0038
Revises: 0037
Create Date: 2026-10-22 15:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0038"
down_revision: str | Sequence[str] | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("users", "children")


def _check(table: str, values: tuple[str, ...]) -> None:
    # The lang column's Enum check (native_enum=False) lists the allowed values; autogenerate doesn't see changes.
    op.drop_constraint(op.f(f"ck_{table}_lang"), table, type_="check")
    op.create_check_constraint(op.f(f"ck_{table}_lang"), table, f"lang IN {values!r}")


def upgrade() -> None:
    """Upgrade schema."""
    for table in TABLES:
        op.execute(f"UPDATE {table} SET lang = 'uz' WHERE lang = 'uz_cyrl'")  # noqa: S608
        _check(table, ("uz", "ru", "en"))


def downgrade() -> None:
    """Downgrade schema."""
    for table in TABLES:
        _check(table, ("uz", "uz_cyrl", "ru", "en"))
