"""Who may see what. Every address that touches a child goes through `require_child_access`.

Rule (TASKS.md section 2, rule 6): one family can never see another family's child. When the answer is no, the
child "does not exist" for that person (404), so nobody can even learn that a child id is real.
"""

import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.modules.accounts.models import FamilyMember, MemberRole, Role, User
from app.modules.auth.session import CurrentUser


async def family_role(db: AsyncSession, user: User, family_id: uuid.UUID) -> MemberRole | None:
    """owner, helper, or None when the person is not in that family."""
    return await db.scalar(
        select(FamilyMember.role).where(FamilyMember.family_id == family_id, FamilyMember.user_id == user.id)
    )


async def may_see_child(db: AsyncSession, user: User, child_family_id: uuid.UUID) -> bool:
    """Family members (owner or helper) see their family's children, whatever their role.
    A therapist also sees children shared with them — sharing arrives with A8.1; until then, nothing.
    Everyone else (other families, physiotherapists, clinics, admins) sees nothing."""
    return await family_role(db, user, child_family_id) is not None


async def require_child_access(db: AsyncSession, user: User, child_family_id: uuid.UUID) -> None:
    if not await may_see_child(db, user, child_family_id):
        raise AppError(404, "not_found")


def require_role(*roles: Role) -> Callable[[User], Awaitable[User]]:
    """FastAPI dependency: `user: Annotated[User, Depends(require_role(Role.admin))]`."""

    async def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise AppError(403, "forbidden")
        return user

    return check


Admin = Annotated[User, Depends(require_role(Role.admin))]
