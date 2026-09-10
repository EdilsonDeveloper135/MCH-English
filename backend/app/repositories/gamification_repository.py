import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dictation import DictationAttempt, DictationSession
from app.models.gamification import UserAchievement
from app.models.recall import RecallAttempt, RecallSession
from app.models.typing_session import TypingSession

_SESSION_MODELS = (TypingSession, RecallSession, DictationSession)


async def _active_dates(db: AsyncSession, model, user_id: uuid.UUID) -> set[date]:
    day = func.date_trunc("day", model.finished_at)
    result = await db.execute(select(day).distinct().where(model.user_id == user_id, model.finished_at.is_not(None)))
    return {row.date() for row in result.scalars().all()}


async def get_active_dates(db: AsyncSession, user_id: uuid.UUID) -> list[date]:
    """Distinct UTC calendar dates with a finished session across Practice, Recall,
    and Dictation -- summed in Python across 3 queries, matching the existing
    multi-query aggregation style (see statistics_service.get_overview)."""
    dates: set[date] = set()
    for model in _SESSION_MODELS:
        dates |= await _active_dates(db, model, user_id)
    return sorted(dates)


async def practice_seconds_on(db: AsyncSession, user_id: uuid.UUID, day: date) -> float:
    """Total finished-session duration across all 3 activity types for one UTC day --
    NOT session_repository.history_for_user, which only looks at typing_sessions (a
    user who practices only Dictation would never meet the daily goal if we used
    that)."""
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    total = 0.0
    for model in _SESSION_MODELS:
        result = await db.execute(
            select(func.coalesce(func.sum(func.extract("epoch", model.finished_at - model.started_at)), 0)).where(
                model.user_id == user_id, model.finished_at >= start, model.finished_at < end
            )
        )
        total += float(result.scalar_one())
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
    for achievement_id in achievement_ids:
        db.add(UserAchievement(user_id=user_id, achievement_id=achievement_id))
    await db.commit()
