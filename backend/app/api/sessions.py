import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import get_redis_client
from app.models.typing_session import TypingSession
from app.models.user import User
from app.repositories import session_repository, text_repository
from app.schemas.sessions import (
    SessionCreate,
    SessionFinish,
    SessionOut,
    SessionStatsSummaryOut,
    stats_cache_key,
)
from app.services import achievements_service, gamification_service, vocabulary_service
from app.services.typing_service import calculate_accuracy, calculate_wpm

logger = structlog.get_logger()

STATS_CACHE_TTL = 3600  # 1 hour
_stats_cache_key = stats_cache_key


async def _invalidate_user_stats_cache(user_id: uuid.UUID) -> None:
    try:
        redis = get_redis_client()
        keys = [key async for key in redis.scan_iter(f"cache:stats:{user_id}:*")]
        if keys:
            await redis.delete(*keys)
    except Exception as exc:  # noqa: BLE001
        logger.warning("stats_cache_invalidation_failed", user_id=str(user_id), error=str(exc))


router = APIRouter()


def _to_session_out(session: TypingSession, new_achievements: list[dict] | None = None) -> SessionOut:
    return SessionOut(
        id=str(session.id),
        text_id=str(session.text_id) if session.text_id else None,
        chunk_id=str(session.chunk_id) if session.chunk_id else None,
        started_at=session.started_at,
        finished_at=session.finished_at,
        correct_characters=session.correct_characters,
        incorrect_characters=session.incorrect_characters,
        total_characters=session.total_characters,
        wpm=session.wpm,
        accuracy=session.accuracy,
        new_achievements=new_achievements or [],
    )


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, payload.text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    chunk = await text_repository.get_chunk_by_id(db, payload.chunk_id, payload.text_id)
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chunk not found")

    session = await session_repository.create(
        db, user_id=current_user.id, text_id=payload.text_id, chunk_id=payload.chunk_id
    )
    return _to_session_out(session)


@router.get("/stats/summary", response_model=SessionStatsSummaryOut)
async def get_stats_summary(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = _stats_cache_key(current_user.id, days)
    try:
        redis = get_redis_client()
        cached = await redis.get(cache_key)
        if cached:
            return SessionStatsSummaryOut.model_validate_json(cached)
    except Exception as exc:  # noqa: BLE001
        logger.warning("stats_cache_read_failed", user_id=str(current_user.id), error=str(exc))

    raw_stats = await session_repository.stats_summary_for_user(db, current_user.id, days=days)
    stats_out = SessionStatsSummaryOut.model_validate(raw_stats)

    try:
        redis = get_redis_client()
        await redis.setex(cache_key, STATS_CACHE_TTL, stats_out.model_dump_json())
    except Exception as exc:  # noqa: BLE001
        logger.warning("stats_cache_write_failed", user_id=str(current_user.id), error=str(exc))

    return stats_out


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    session = await session_repository.get_by_id(db, session_id, current_user.id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _to_session_out(session)


@router.patch("/{session_id}", response_model=SessionOut)
async def finish_session(
    session_id: uuid.UUID,
    payload: SessionFinish,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await session_repository.get_by_id(db, session_id, current_user.id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Finishing twice would insert the error rows a second time and count every word
    # of the chunk as another encounter, quietly distorting the mastery scores that
    # Weak Words and Recall are built on.
    if session.finished_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta sesion ya fue finalizada")

    accuracy = calculate_accuracy(payload.correct_characters, payload.total_characters)
    wpm = calculate_wpm(payload.correct_characters, payload.duration_seconds)

    errors = [
        {
            "expected_char": err.expected_char,
            "typed_char": err.typed_char,
            "position": err.position,
            "word": err.word,
            "sentence_id": err.sentence_id,
        }
        for err in payload.errors
    ]

    session = await session_repository.finish(
        db,
        session,
        correct=payload.correct_characters,
        incorrect=payload.incorrect_characters,
        total=payload.total_characters,
        wpm=wpm,
        accuracy=accuracy,
        errors=errors,
        duration_seconds=payload.duration_seconds,
    )

    session_sentences = await session_repository.get_sentences_for_session(db, session)
    error_words = {err.word.lower() for err in payload.errors if err.word}
    await vocabulary_service.record_session_words(db, current_user.id, session_sentences, error_words)
    await gamification_service.check_and_unlock_achievements(db, current_user.id)
    new_achievements = await achievements_service.evaluate_and_unlock(db, current_user.id)

    await _invalidate_user_stats_cache(current_user.id)

    return _to_session_out(session, new_achievements=new_achievements)
