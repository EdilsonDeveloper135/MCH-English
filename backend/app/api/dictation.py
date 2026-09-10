import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.dictation import DictationAttempt, DictationAudio, DictationSession
from app.models.text import Sentence, Text, TextChunk
from app.models.user import User
from app.repositories import text_repository
from app.schemas.dictation import (
    DictationAttemptCreate,
    DictationAttemptOut,
    DictationRoundOut,
    DictationSessionCreate,
    DictationSessionOut,
)
from app.services import gamification_service, recall_service, tts_service
from app.services.typing_service import calculate_accuracy

router = APIRouter()

MAX_ROUNDS = 15


async def _get_owned_sentence(db: AsyncSession, sentence_id: uuid.UUID, user_id: uuid.UUID) -> Sentence | None:
    result = await db.execute(
        select(Sentence)
        .join(TextChunk, Sentence.chunk_id == TextChunk.id)
        .join(Text, TextChunk.text_id == Text.id)
        .where(Sentence.id == sentence_id, Text.user_id == user_id)
    )
    return result.scalar_one_or_none()


@router.get("/audio/{sentence_id}")
async def get_audio(
    sentence_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    sentence = await _get_owned_sentence(db, sentence_id, current_user.id)
    if sentence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentence not found")

    result = await db.execute(select(DictationAudio).where(DictationAudio.sentence_id == sentence_id))
    cached = result.scalar_one_or_none()

    if cached is not None:
        audio_bytes = tts_service.read_cached_audio(sentence_id)
        if audio_bytes is not None:
            return Response(content=audio_bytes, media_type="audio/wav")
        # Row exists but the file is gone (e.g. the volume was wiped independently of
        # the DB) -- fall through and resynthesize/rewrite instead of 500ing.

    audio_bytes = tts_service.synthesize(sentence.content)
    tts_service.write_cached_audio(sentence_id, audio_bytes)
    # Race-safe: two concurrent first-requests for the same sentence would both
    # synthesize (wasteful but harmless, and deterministic -- eSpeak-NG produces
    # identical bytes for the same input) and both write the file and try to insert
    # the cache-marker row; ON CONFLICT DO NOTHING means the second insert is a
    # no-op instead of raising IntegrityError on the unique sentence_id constraint.
    stmt = (
        pg_insert(DictationAudio)
        .values(sentence_id=sentence_id)
        .on_conflict_do_nothing(index_elements=[DictationAudio.sentence_id])
    )
    await db.execute(stmt)
    await db.commit()

    return Response(content=audio_bytes, media_type="audio/wav")


@router.post("/sessions", response_model=DictationSessionOut, status_code=status.HTTP_201_CREATED)
async def create_dictation_session(
    payload: DictationSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, payload.text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")
    if text.status != "ready":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Text is still processing")

    sentences = await text_repository.get_ordered_sentences(db, text.id)
    sentences = sentences[:MAX_ROUNDS]
    if not sentences:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No sentences available for this text")

    session = DictationSession(user_id=current_user.id, text_id=text.id)
    db.add(session)
    await db.commit()

    return DictationSessionOut(
        session_id=str(session.id),
        rounds=[DictationRoundOut(sentence_id=str(s.id), content=s.content) for s in sentences],
    )


@router.post("/attempts", response_model=DictationAttemptOut, status_code=status.HTTP_201_CREATED)
async def create_dictation_attempt(
    payload: DictationAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DictationSession).where(
            DictationSession.id == payload.dictation_session_id, DictationSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dictation session not found")

    # IDOR guard: without this, any authenticated user could submit an attempt
    # against a sentence_id belonging to a different user's private text.
    sentence = await _get_owned_sentence(db, payload.sentence_id, current_user.id)
    if sentence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentence not found")

    accuracy = calculate_accuracy(payload.correct_characters, payload.total_characters)
    correct_words, incorrect_words = recall_service.score_attempt(sentence.content, payload.typed)

    attempt = DictationAttempt(
        dictation_session_id=session.id,
        sentence_id=sentence.id,
        expected=sentence.content,
        typed=payload.typed,
        accuracy=accuracy,
        correct_words=correct_words,
        incorrect_words=incorrect_words,
        duration_seconds=payload.duration_seconds,
    )
    db.add(attempt)
    await db.commit()

    return DictationAttemptOut(
        id=str(attempt.id),
        expected=attempt.expected,
        typed=attempt.typed,
        accuracy=attempt.accuracy,
        correct_words=attempt.correct_words,
        incorrect_words=attempt.incorrect_words,
    )


@router.patch("/sessions/{session_id}/finish", status_code=status.HTTP_204_NO_CONTENT)
async def finish_dictation_session(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DictationSession).where(DictationSession.id == session_id, DictationSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dictation session not found")

    session.finished_at = datetime.now(timezone.utc)
    await db.commit()
    await gamification_service.check_and_unlock_achievements(db, current_user.id)
