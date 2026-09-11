import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import Date, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession


from app.models.dictation import DictationAttempt, DictationSession
from app.models.gamification import UserAchievement
from app.models.recall import RecallAttempt, RecallSession
from app.models.typing_session import TypingSession

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

_SESSION_MODELS = (TypingSession, RecallSession, DictationSession)


async def _active_dates(db: AsyncSession, model, user_id: uuid.UUID, tz_str: str = "UTC") -> set[date]:
    # Convert UTC timestamptz to user's timezone before grouping by calendar day,
    # so an evening session (e.g. 21:00 in UTC-5) counts toward today instead of tomorrow.
    day = func.cast(func.timezone(tz_str, model.finished_at), Date)
    result = await db.execute(select(day).distinct().where(model.user_id == user_id, model.finished_at.is_not(None)))
    return {row if isinstance(row, date) else row.date() for row in result.scalars().all()}


async def get_active_dates(db: AsyncSession, user_id: uuid.UUID, tz_str: str = "UTC") -> list[date]:
    """Distinct calendar dates (in the user's timezone) with a finished session across
    Practice, Recall, and Dictation."""
    dates: set[date] = set()
    for model in _SESSION_MODELS:
        dates |= await _active_dates(db, model, user_id, tz_str=tz_str)
    return sorted(dates)


async def practice_seconds_on(db: AsyncSession, user_id: uuid.UUID, day: date, tz_str: str = "UTC") -> float:
    """Total ACTIVE (client-measured, not wall-clock) duration across all 3 activity
    types for one calendar day in the user's timezone -- NOT session_repository.history_for_user,
    which only looks at typing_sessions."""
    try:
        tz = ZoneInfo(tz_str)
    except (ZoneInfoNotFoundError, ValueError):
        tz = timezone.utc

    start_local = datetime.combine(day, time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    start = start_local.astimezone(timezone.utc)
    end = end_local.astimezone(timezone.utc)

    typing_result = await db.execute(
        select(func.coalesce(func.sum(TypingSession.duration_seconds), 0)).where(
            TypingSession.user_id == user_id, TypingSession.finished_at >= start, TypingSession.finished_at < end
        )
    )
    total = float(typing_result.scalar_one())

    recall_result = await db.execute(
        select(func.coalesce(func.sum(RecallAttempt.duration_seconds), 0))
        .join(RecallSession, RecallAttempt.recall_session_id == RecallSession.id)
        .where(RecallSession.user_id == user_id, RecallSession.finished_at >= start, RecallSession.finished_at < end)
    )
    total += float(recall_result.scalar_one())

    dictation_result = await db.execute(
        select(func.coalesce(func.sum(DictationAttempt.duration_seconds), 0))
        .join(DictationSession, DictationAttempt.dictation_session_id == DictationSession.id)
        .where(
            DictationSession.user_id == user_id,
            DictationSession.finished_at >= start,
            DictationSession.finished_at < end,
        )
    )
    total += float(dictation_result.scalar_one())

    return total


async def total_typing_xp(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(TypingSession.correct_characters), 0)).where(
            TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None)
        )
    )
    return int(result.scalar_one())


async def total_word_xp(db: AsyncSession, user_id: uuid.UUID) -> int:
    recall_result = await db.execute(
        select(func.coalesce(func.sum(RecallAttempt.correct_words), 0))
        .join(RecallSession, RecallAttempt.recall_session_id == RecallSession.id)
        .where(RecallSession.user_id == user_id)
    )
    dictation_result = await db.execute(
        select(func.coalesce(func.sum(DictationAttempt.correct_words), 0))
        .join(DictationSession, DictationAttempt.dictation_session_id == DictationSession.id)
        .where(DictationSession.user_id == user_id)
    )
    return int(recall_result.scalar_one()) + int(dictation_result.scalar_one())


async def recall_sessions_finished_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(RecallSession.id)).where(
            RecallSession.user_id == user_id, RecallSession.finished_at.is_not(None)
        )
    )
    return result.scalar_one()


async def dictation_sessions_finished_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(DictationSession.id)).where(
            DictationSession.user_id == user_id, DictationSession.finished_at.is_not(None)
        )
    )
    return result.scalar_one()


async def has_perfect_accuracy_session(db: AsyncSession, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(TypingSession.id)
        .where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None), TypingSession.accuracy >= 100)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def get_unlocked_achievement_ids(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    result = await db.execute(select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id))
    return set(result.scalars().all())


async def unlock_achievements(db: AsyncSession, user_id: uuid.UUID, achievement_ids: list[str]) -> None:
    if not achievement_ids:
        return
    for achievement_id in achievement_ids:
        stmt = (
            pg_insert(UserAchievement)
            .values(user_id=user_id, achievement_id=achievement_id)
            .on_conflict_do_nothing(index_elements=["user_id", "achievement_id"])
        )
        await db.execute(stmt)
    await db.commit()
