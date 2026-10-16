"""A3.1: exercises, one video per exercise per language, and review notes."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.videos.models import Exercise, ReviewDecision, Video, VideoLang, VideoReview, VideoStatus
from tests.test_accounts_tables import _rejected

pytestmark = pytest.mark.anyio


def putty(**change: object) -> Exercise:
    fields: dict[str, object] = {
        "id": "test_putty",
        "title": {"uz": "Plastilinni siqish", "ru": "Сжимаем пластилин", "en": "Squeeze the putty"},
        "body_area": "hands",
        "goals": ["hands"],
        "gmfcs": [1, 2, 3, 4, 5],
        "ages": ["2-4", "5-8"],
        "tool": "putty",
        "difficulty": 1,
        "conflicts": [],
    }
    return Exercise(**(fields | change))


async def test_a_new_video_waits_for_review(session: AsyncSession) -> None:
    session.add(putty())
    video = Video(exercise_id="test_putty", lang=VideoLang.uz, storage_key="videos/test_putty/uz-1.mp4")
    session.add(video)
    await session.flush()
    assert video.status == VideoStatus.waiting_review
    assert video.approved_by is None and video.approved_at is None
    session.add(
        VideoReview(
            video_id=video.id,
            decision=ReviewDecision.changes_requested,
            note="Slower, please",
            storage_key=video.storage_key,
        )
    )
    await session.flush()
    await session.rollback()


async def test_one_video_per_exercise_per_language(session: AsyncSession) -> None:
    session.add(putty())
    await session.flush()
    session.add_all(
        [
            Video(exercise_id="test_putty", lang=VideoLang.uz, storage_key="a"),
            Video(exercise_id="test_putty", lang=VideoLang.ru, storage_key="b"),  # another language: fine
        ]
    )
    assert not await _rejected(session)

    session.add(putty())
    await session.flush()
    session.add_all(
        [
            Video(exercise_id="test_putty", lang=VideoLang.uz, storage_key="a"),
            Video(exercise_id="test_putty", lang=VideoLang.uz, storage_key="c"),  # same language twice
        ]
    )
    assert await _rejected(session)


async def test_difficulty_is_1_to_3(session: AsyncSession) -> None:
    session.add(putty(difficulty=4))
    assert await _rejected(session)


async def test_only_known_languages_and_statuses(session: AsyncSession) -> None:
    session.add(putty())
    await session.flush()
    session.add(Video(exercise_id="test_putty", lang="uz_cyrl", storage_key="a"))  # Cyrillic uses the uz video
    assert await _rejected(session)
    session.add(putty())
    await session.flush()
    session.add(Video(exercise_id="test_putty", lang=VideoLang.uz, storage_key="a", status="published"))
    assert await _rejected(session)


async def test_an_exercise_with_videos_cannot_be_deleted(session: AsyncSession) -> None:
    exercise = putty()
    session.add(exercise)
    await session.flush()
    session.add(Video(exercise_id="test_putty", lang=VideoLang.en, storage_key="a"))
    await session.flush()
    await session.delete(exercise)
    assert await _rejected(session)  # set active=false instead; old plans still point at it
