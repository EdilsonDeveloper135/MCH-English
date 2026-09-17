import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.text import Sentence, Text
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
    duration_seconds: float,
) -> TypingSession:
    now = datetime.now(timezone.utc)
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    server_elapsed = max((now - started_at).total_seconds(), 0.0)

    session.finished_at = now
    session.correct_characters = correct
    session.incorrect_characters = incorrect
    session.total_characters = total
    session.wpm = wpm
    session.accuracy = accuracy
    # Trust the client's measured active-typing time, but never beyond how much wall
    # clock actually passed -- a stale/replayed client value can't inflate this past
    # what the server itself observed.
    session.duration_seconds = min(max(duration_seconds, 0.0), server_elapsed)

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
            func.coalesce(func.sum(TypingSession.duration_seconds), 0),
        ).where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
    )
    total_sessions, avg_wpm, avg_accuracy, best_wpm, total_errors, total_seconds = result.one()


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
            func.coalesce(func.sum(TypingSession.duration_seconds), 0),
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


async def stats_summary_for_user(db: AsyncSession, user_id: uuid.UUID, days: int = 30) -> dict:
    """Returns trend of recent sessions, top error characters, daily summaries, and recent session history."""
    # 1. WPM Trend: up to last 30 finished sessions
    trend_result = await db.execute(
        select(TypingSession.finished_at, TypingSession.wpm, TypingSession.accuracy)
        .where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
        .order_by(TypingSession.finished_at.desc())
        .limit(30)
    )
    trend_rows = list(reversed(trend_result.all()))
    wpm_trend = [
        {
            "date": r[0].strftime("%d/%m %H:%M") if r[0] else "",
            "wpm": round(float(r[1]), 1),
            "accuracy": round(float(r[2]), 1),
        }
        for r in trend_rows
    ]

    # 2. Error characters: top 10 most common error expected characters
    error_result = await db.execute(
        select(TypingError.expected_char, func.count(TypingError.id))
        .join(TypingSession, TypingError.session_id == TypingSession.id)
        .where(TypingSession.user_id == user_id)
        .group_by(TypingError.expected_char)
        .order_by(func.count(TypingError.id).desc())
        .limit(10)
    )
    error_chars = [
        {"char": char, "count": int(count)}
        for char, count in error_result.all()
    ]

    # 3. Daily Summary for heatmap
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    day_col = func.date_trunc("day", TypingSession.finished_at)
    daily_result = await db.execute(
        select(
            day_col.label("day"),
            func.count(TypingSession.id),
            func.coalesce(func.avg(TypingSession.wpm), 0),
            func.coalesce(func.avg(TypingSession.accuracy), 0),
        )
        .where(
            TypingSession.user_id == user_id,
            TypingSession.finished_at.is_not(None),
            TypingSession.finished_at >= cutoff,
        )
        .group_by(day_col)
        .order_by(day_col)
    )
    daily_summary = [
        {
            "date": d.date().isoformat(),
            "sessions": int(cnt),
            "avg_wpm": round(float(avg_w), 1),
            "avg_accuracy": round(float(avg_acc), 1),
        }
        for d, cnt, avg_w, avg_acc in daily_result.all()
    ]

    # 4. Recent 50 sessions with text title for table and CSV export
    sessions_query = (
        select(
            TypingSession.id,
            TypingSession.finished_at,
            TypingSession.wpm,
            TypingSession.accuracy,
            TypingSession.incorrect_characters,
            TypingSession.duration_seconds,
            TypingSession.correct_characters,
            func.coalesce(Text.title, "Palabras Débiles").label("text_title"),
        )
        .outerjoin(Text, TypingSession.text_id == Text.id)
        .where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
        .order_by(TypingSession.finished_at.desc())
        .limit(50)
    )
    recent_rows = (await db.execute(sessions_query)).all()
    recent_sessions = [
        {
            "id": str(r[0]),
            "date": r[1].strftime("%Y-%m-%d %H:%M") if r[1] else "",
            "text_title": r[7],
            "wpm": round(float(r[2]), 1),
            "accuracy": round(float(r[3]), 1),
            "errors": int(r[4]),
            "duration_seconds": round(float(r[5]), 1),
            "xp_earned": int(r[6]),
        }
        for r in recent_rows
    ]

    return {
        "wpm_trend": wpm_trend,
        "error_chars": error_chars,
        "daily_summary": daily_summary,
        "recent_sessions": recent_sessions,
    }

