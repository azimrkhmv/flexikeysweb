"""Import every module's tables here, so Alembic sees them all."""

from app.modules.accounts.models import Family, FamilyMember, User
from app.modules.audit.models import AuditEntry
from app.modules.auth.models import RefreshToken
from app.modules.children.consents import ChildConsent
from app.modules.children.models import Child

__all__ = ["AuditEntry", "Child", "ChildConsent", "Family", "FamilyMember", "RefreshToken", "User"]
