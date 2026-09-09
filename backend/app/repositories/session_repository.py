import uuid
from datetime import datetime, timedelta, timezone

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
            func.coalesce(func.sum(TypingSession.incorrect_characters), 0),
        ).where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
    )
    total_sessions, avg_wpm, avg_accuracy, best_wpm, total_errors = result.one()

    duration_result = await db.execute(
        select(
            func.coalesce(
                func.sum(func.extract("epoch", TypingSession.finished_at - TypingSession.started_at)), 0
            )
        ).where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
    )
    total_seconds = duration_result.scalar_one()

    current_wpm_result = await db.execute(
        select(TypingSession.wpm)
        .where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
        .order_by(TypingSession.finished_at.desc())
        .limit(1)
    )
    current_wpm = current_wpm_result.scalar_one_or_none() or 0.0

    return {
        "total_sessions": total_sessions,
        "total_practice_seconds": float(total_seconds),
        "average_wpm": round(float(avg_wpm), 2),
        "average_accuracy": round(float(avg_accuracy), 2),
        "best_wpm": round(float(best_wpm), 2),
        "current_wpm": round(float(current_wpm), 2),
        "total_errors": int(total_errors),
    }


async def sentences_completed_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Distinct sentences ever covered by a finished session -- consistent with
    words_encountered/words_learned being distinct counts, not cumulative-with-repeats
    (replaying the same chunk or a Weak Words review doesn't inflate this)."""
    chunk_result = await db.execute(
        select(Sentence.id)
        .distinct()
        .join(TypingSession, Sentence.chunk_id == TypingSession.chunk_id)
        .where(
            TypingSession.user_id == user_id,
            TypingSession.finished_at.is_not(None),
            TypingSession.chunk_id.is_not(None),
        )
    )
    sentence_ids = set(chunk_result.scalars().all())

    review_result = await db.execute(
        select(TypingSession.review_sentence_ids).where(
            TypingSession.user_id == user_id,
            TypingSession.finished_at.is_not(None),
            TypingSession.review_sentence_ids.is_not(None),
        )
    )
    for ids in review_result.scalars().all():
        sentence_ids.update(ids)

    return len(sentence_ids)


async def history_for_user(db: AsyncSession, user_id: uuid.UUID, days: int | None = None) -> list[dict]:
    """Per-day averages/totals for finished sessions, oldest first. Only days with an
    actual session appear -- no zero-filled gaps."""
    day = func.date_trunc("day", TypingSession.finished_at)
    conditions = [TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None)]
    if days is not None:
        conditions.append(TypingSession.finished_at >= datetime.now(timezone.utc) - timedelta(days=days))

    result = await db.execute(
        select(
            day.label("day"),
            func.coalesce(func.avg(TypingSession.wpm), 0),
            func.coalesce(func.avg(TypingSession.accuracy), 0),
            func.coalesce(
                func.sum(func.extract("epoch", TypingSession.finished_at - TypingSession.started_at)), 0
            ),
        )
        .where(*conditions)
        .group_by(day)
        .order_by(day)
    )
    return [
        {
            "date": bucket_day.date().isoformat(),
            "average_wpm": round(float(avg_wpm), 2),
            "average_accuracy": round(float(avg_accuracy), 2),
            "practice_seconds": float(practice_seconds),
        }
        for bucket_day, avg_wpm, avg_accuracy, practice_seconds in result.all()
    ]
