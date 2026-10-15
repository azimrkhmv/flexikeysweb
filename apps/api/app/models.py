"""Import every module's tables here, so Alembic sees them all."""

from app.modules.accounts.models import Family, FamilyMember, User

__all__ = ["Family", "FamilyMember", "User"]
