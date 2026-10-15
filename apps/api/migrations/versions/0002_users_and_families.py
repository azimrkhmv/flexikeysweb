"""users and families

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-15
"""

from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | None = None
depends_on: str | None = None


def _enum(name: str, *values: str) -> sa.Enum:
    # The column's Enum creates its own check constraint (ck_<table>_<name>).
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True, length=16)


def _id_time() -> list[sa.Column[Any]]:
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table("families", *_id_time())
    op.create_table(
        "users",
        *_id_time(),
        sa.Column("phone", sa.String(16), nullable=False),
        sa.Column("role", _enum("role", "parent", "therapist", "physio", "clinic", "admin"), nullable=False),
        sa.Column("status", _enum("userstatus", "active", "disabled"), nullable=False),
        sa.Column("lang", _enum("lang", "uz", "uz_cyrl", "ru", "en"), nullable=False),
        sa.Column("region", sa.String(32), nullable=True),
        sa.Column("district", sa.String(64), nullable=True),
        sa.UniqueConstraint("phone", name=op.f("uq_users_phone")),
    )
    op.create_table(
        "family_members",
        *_id_time(),
        sa.Column("family_id", sa.Uuid(), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", _enum("memberrole", "owner", "helper"), nullable=False),
        sa.UniqueConstraint("family_id", "user_id", name=op.f("uq_family_members_family_id")),
    )
    op.create_index(op.f("ix_family_members_user_id"), "family_members", ["user_id"])
    op.create_index(
        "uq_family_members_one_owner",
        "family_members",
        ["family_id"],
        unique=True,
        postgresql_where=sa.text("role = 'owner'"),
    )
    op.create_index(
        "uq_family_members_owns_one",
        "family_members",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("role = 'owner'"),
    )


def downgrade() -> None:
    op.drop_table("family_members")
    op.drop_table("users")
    op.drop_table("families")
