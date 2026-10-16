"""A4.1: plans, their 28 days of items, and the reasons, stored the way the website's roadmap looks."""

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts.models import Family
from app.modules.children.models import Child, Sex
from app.modules.plans.models import ItemKind, Plan, PlanItem, PlanReason
from tests.test_accounts_tables import _rejected

pytestmark = pytest.mark.anyio


async def a_plan(session: AsyncSession) -> Plan:
    family = Family()
    session.add(family)
    await session.flush()
    child = Child(family_id=family.id, name="Ali", birth_date=date(2019, 5, 1), sex=Sex.boy)
    session.add(child)
    await session.flush()
    plan = Plan(child_id=child.id, start_date=date(2026, 10, 12), engine_version="web-1", exercises_allowed=True)
    session.add(plan)
    await session.flush()
    return plan


async def test_a_day_of_the_plan_with_its_reasons(session: AsyncSession) -> None:
    plan = await a_plan(session)
    session.add_all(
        [  # day 1 of roadmap_cases.json case 1
            PlanItem(plan_id=plan.id, day=0, position=0, kind=ItemKind.exercise, ref="bridge", level=2),
            PlanItem(plan_id=plan.id, day=0, position=1, kind=ItemKind.exercise, ref="bunny_hops", level=3),
            PlanItem(plan_id=plan.id, day=0, position=0, kind=ItemKind.game, ref="path", minutes=5),
            PlanItem(plan_id=plan.id, day=0, position=1, kind=ItemKind.game, ref="light_path", minutes=5),
            PlanReason(plan_id=plan.id, position=0, slot=ItemKind.exercise, goal="walk", ref="bridge", level=2),
        ]
    )
    await session.flush()
    rows = await session.execute(
        select(PlanItem.kind, PlanItem.ref, PlanItem.level, PlanItem.minutes)
        .where(PlanItem.plan_id == plan.id, PlanItem.day == 0)
        .order_by(PlanItem.kind, PlanItem.position)
    )
    assert list(rows) == [
        ("exercise", "bridge", 2, None),
        ("exercise", "bunny_hops", 3, None),
        ("game", "path", None, 5),
        ("game", "light_path", None, 5),
    ]
    assert plan.engine_version == "web-1"
    await session.rollback()


@pytest.mark.parametrize(
    "item",
    [
        {"kind": ItemKind.exercise, "ref": "bridge", "level": None, "minutes": None},  # exercise without a level
        {"kind": ItemKind.exercise, "ref": "bridge", "level": 2, "minutes": 5},  # exercise with minutes
        {"kind": ItemKind.game, "ref": "path", "level": None, "minutes": None},  # game without minutes
        {"kind": ItemKind.game, "ref": "path", "level": 1, "minutes": 5},  # game with a level
        {"kind": ItemKind.game, "ref": "path", "level": None, "minutes": 5, "day": 28},  # past the 4 weeks
    ],
)
async def test_items_must_make_sense(session: AsyncSession, item: dict[str, object]) -> None:
    plan = await a_plan(session)
    session.add(PlanItem(plan_id=plan.id, position=0, **({"day": 0} | item)))
    assert await _rejected(session)


async def test_deleting_the_child_deletes_its_plans(session: AsyncSession) -> None:
    plan = await a_plan(session)
    session.add(PlanItem(plan_id=plan.id, day=0, position=0, kind=ItemKind.game, ref="path", minutes=5))
    await session.flush()
    child = await session.get(Child, plan.child_id)
    await session.delete(child)
    await session.flush()
    assert await session.scalar(select(PlanItem.id).where(PlanItem.plan_id == plan.id)) is None
    await session.rollback()
