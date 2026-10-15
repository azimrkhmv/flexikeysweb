import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts.models import Family, FamilyMember, MemberRole, Role, User

pytestmark = pytest.mark.anyio


async def _rejected(session: AsyncSession) -> bool:
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return True
    await session.rollback()
    return False


async def test_a_parent_owns_a_family(session: AsyncSession) -> None:
    user, family = User(phone="+998900000001", role=Role.parent), Family()
    session.add_all([user, family])
    await session.flush()
    session.add(FamilyMember(family_id=family.id, user_id=user.id, role=MemberRole.owner))
    await session.flush()
    assert user.status == "active"
    assert user.lang == "uz"
    await session.rollback()


async def test_phone_is_unique(session: AsyncSession) -> None:
    session.add_all([User(phone="+998900000002", role=Role.parent), User(phone="+998900000002", role=Role.admin)])
    assert await _rejected(session)


async def test_unknown_role_is_refused(session: AsyncSession) -> None:
    session.add(User(phone="+998900000003", role="teacher"))
    assert await _rejected(session)


async def test_one_owner_per_family(session: AsyncSession) -> None:
    a, b, family = (
        User(phone="+998900000004", role=Role.parent),
        User(phone="+998900000005", role=Role.parent),
        Family(),
    )
    session.add_all([a, b, family])
    await session.flush()
    session.add_all(
        [
            FamilyMember(family_id=family.id, user_id=a.id, role=MemberRole.owner),
            FamilyMember(family_id=family.id, user_id=b.id, role=MemberRole.owner),
        ]
    )
    assert await _rejected(session)


async def test_a_person_owns_at_most_one_family(session: AsyncSession) -> None:
    user, f1, f2 = User(phone="+998900000006", role=Role.parent), Family(), Family()
    session.add_all([user, f1, f2])
    await session.flush()
    session.add_all(
        [
            FamilyMember(family_id=f1.id, user_id=user.id, role=MemberRole.owner),
            FamilyMember(family_id=f2.id, user_id=user.id, role=MemberRole.owner),
        ]
    )
    assert await _rejected(session)


async def test_owner_and_helper_together(session: AsyncSession) -> None:
    owner, helper, family = (
        User(phone="+998900000007", role=Role.parent),
        User(phone="+998900000008", role=Role.parent),
        Family(),
    )
    session.add_all([owner, helper, family])
    await session.flush()
    session.add_all(
        [
            FamilyMember(family_id=family.id, user_id=owner.id, role=MemberRole.owner),
            FamilyMember(family_id=family.id, user_id=helper.id, role=MemberRole.helper),
        ]
    )
    assert not await _rejected(session)
