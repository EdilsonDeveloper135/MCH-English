import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.text import Sentence
from app.models.typing_session import TypingError, TypingSession


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    text_id: uuid.UUID | None = None,
    chunk_id: uuid.UUID | None = None,
    review_sentence_ids: list[uuid.UUID] | None = None,
) -> TypingSession:
    session = TypingSession(
        user_id=user_id,
        text_id=text_id,
        chunk_id=chunk_id,
        review_sentence_ids=review_sentence_ids,
        errors=[],
    )
    db.add(session)
    await db.commit()
    return session


async def get_by_id(db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID) -> TypingSession | None:
    result = await db.execute(
        select(TypingSession).where(TypingSession.id == session_id, TypingSession.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_sentences_for_session(db: AsyncSession, session: TypingSession) -> list[Sentence]:
    """Resolves the real sentences a session covered -- a chunk's sentences for a
    normal practice session, or the stored ad-hoc list for a Weak Words review."""
    if session.chunk_id is not None:
        result = await db.execute(select(Sentence).where(Sentence.chunk_id == session.chunk_id))
        return list(result.scalars().all())

    if session.review_sentence_ids:
        result = await db.execute(select(Sentence).where(Sentence.id.in_(session.review_sentence_ids)))
        return list(result.scalars().all())

    return []


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
