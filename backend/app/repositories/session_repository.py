import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.typing_session import TypingError, TypingSession


async def create(db: AsyncSession, *, user_id: uuid.UUID, text_id: uuid.UUID, chunk_id: uuid.UUID) -> TypingSession:
    session = TypingSession(user_id=user_id, text_id=text_id, chunk_id=chunk_id, errors=[])
    db.add(session)
    await db.commit()
    return session


async def get_by_id(db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID) -> TypingSession | None:
    result = await db.execute(
        select(TypingSession).where(TypingSession.id == session_id, TypingSession.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def finish(
    db: AsyncSession,
    session: TypingSession,
    *,
    correct: int,
    incorrect: int,
    total: int,
    wpm: float,
    accuracy: float,
    errors: list[dict],
) -> TypingSession:
    session.finished_at = datetime.now(timezone.utc)
    session.correct_characters = correct
    session.incorrect_characters = incorrect
    session.total_characters = total
    session.wpm = wpm
    session.accuracy = accuracy

    for err in errors:
        db.add(TypingError(session_id=session.id, **err))

    await db.commit()
    return session


async def overview_for_user(db: AsyncSession, user_id: uuid.UUID) -> dict:
    result = await db.execute(
        select(
            func.count(TypingSession.id),
            func.coalesce(func.avg(TypingSession.wpm), 0),
            func.coalesce(func.avg(TypingSession.accuracy), 0),
            func.coalesce(func.max(TypingSession.wpm), 0),
        ).where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
    )
    total_sessions, avg_wpm, avg_accuracy, best_wpm = result.one()

    duration_result = await db.execute(
        select(
            func.coalesce(
                func.sum(func.extract("epoch", TypingSession.finished_at - TypingSession.started_at)), 0
            )
        ).where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
    )
    total_seconds = duration_result.scalar_one()

    return {
        "total_sessions": total_sessions,
        "total_practice_seconds": float(total_seconds),
        "average_wpm": round(float(avg_wpm), 2),
        "average_accuracy": round(float(avg_accuracy), 2),
        "best_wpm": round(float(best_wpm), 2),
    }
