"""Import every module's tables here, so Alembic sees them all."""

from app.modules.accounts.models import Family, FamilyMember, User
from app.modules.audit.models import AuditEntry
from app.modules.auth.models import RefreshToken
from app.modules.children.consents import ChildConsent
from app.modules.children.models import Child
from app.modules.intake.models import IntakeAnswer, IntakeRound
from app.modules.plans.models import FixedLevel, Plan, PlanItem, PlanReason
from app.modules.play.models import (
    AccessProfile,
    GamePlayed,
    GameSession,
    PlayCheckRun,
    SkillLevel,
    Try,
    VoiceCard,
)
from app.modules.today.models import DailyAnswer, DailyQuestion, PausedDay, TaskDone
from app.modules.videos.models import Exercise, Video, VideoReview

__all__ = [
    "AccessProfile",
    "AuditEntry",
    "Child",
    "ChildConsent",
    "DailyAnswer",
    "DailyQuestion",
    "Exercise",
    "Family",
    "FamilyMember",
    "FixedLevel",
    "GamePlayed",
    "GameSession",
    "IntakeAnswer",
    "IntakeRound",
    "PausedDay",
    "Plan",
    "PlanItem",
    "PlanReason",
    "PlayCheckRun",
    "RefreshToken",
    "SkillLevel",
    "TaskDone",
    "Try",
    "User",
    "Video",
    "VideoReview",
    "VoiceCard",
]
