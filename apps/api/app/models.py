"""Import every module's tables here, so Alembic sees them all."""

from app.modules.accounts.models import Family, FamilyMember, User
from app.modules.audit.models import AuditEntry
from app.modules.auth.models import RefreshToken
from app.modules.children.consents import ChildConsent
from app.modules.children.models import Child
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.plans.models import Plan, PlanItem, PlanReason
from app.modules.videos.models import Exercise, Video, VideoReview

__all__ = [
    "AuditEntry",
    "Child",
    "ChildConsent",
    "Exercise",
    "Family",
    "FamilyMember",
    "IntakeAnswer",
    "IntakeRound",
    "Plan",
    "PlanItem",
    "PlanReason",
    "RefreshToken",
    "User",
    "Video",
    "VideoReview",
]
