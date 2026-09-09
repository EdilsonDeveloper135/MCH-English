import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.recall import RecallAttempt, RecallSession
from app.models.text import Sentence
from app.models.user import User
from app.repositories import text_repository
from app.schemas.recall import (
    BlankOut,
    RecallAttemptCreate,
    RecallAttemptOut,
    RecallSessionCreate,
    RecallSessionOut,
    RoundOut,
)
from app.services import recall_service
from app.services.typing_service import calculate_accuracy

router = APIRouter()


@router.post("/sessions", response_model=RecallSessionOut, status_code=status.HTTP_201_CREATED)
async def create_recall_session(
    payload: RecallSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, payload.text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")
    if text.status != "ready":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Text is still processing")

    if payload.mode == "missing_words":
        rounds_data = await recall_service.build_missing_words_rounds(db, current_user.id, text)
        rounds = [
            RoundOut(
                sentence_id=r.sentence_id,
                content=r.content,
                blanks=[BlankOut(start=b.start, end=b.end) for b in r.blanks],
            )
            for r in rounds_data
        ]
    else:
        if text.alignment_status != "confirmed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This text has no confirmed translation to practice Spanish -> English",
            )
        rounds_data = await recall_service.build_spanish_to_english_rounds(db, text)
        rounds = [
            RoundOut(sentence_id=r.sentence_id, spanish_prompt=r.spanish_prompt, english_content=r.english_content)
            for r in rounds_data
        ]

    if not rounds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No sentences available for this mode")

    session = RecallSession(user_id=current_user.id, text_id=text.id, mode=payload.mode)
    db.add(session)
    await db.commit()

    return RecallSessionOut(session_id=str(session.id), mode=payload.mode, rounds=rounds)


@router.post("/attempts", response_model=RecallAttemptOut, status_code=status.HTTP_201_CREATED)
async def create_recall_attempt(
    payload: RecallAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecallSession).where(
            RecallSession.id == payload.recall_session_id, RecallSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recall session not found")

    sentence = await db.get(Sentence, payload.sentence_id)
    if sentence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentence not found")

    accuracy = calculate_accuracy(payload.correct_characters, payload.total_characters)

    if payload.blanks:
        content_len = len(sentence.content)
        expected_words = [
            sentence.content[max(0, b.start) : min(content_len, b.end)] for b in payload.blanks
        ]
        expected = " ".join(expected_words)
        correct_words, incorrect_words = recall_service.score_missing_words_attempt(expected_words, payload.typed)
    else:
        expected = sentence.content
        correct_words, incorrect_words = recall_service.score_attempt(expected, payload.typed)

    attempt = RecallAttempt(
        recall_session_id=session.id,
        sentence_id=sentence.id,
        expected=expected,
        typed=payload.typed,
        accuracy=accuracy,
        correct_words=correct_words,
        incorrect_words=incorrect_words,
        duration_seconds=payload.duration_seconds,
    )
    db.add(attempt)
    await db.commit()

    return RecallAttemptOut(
        id=str(attempt.id),
        expected=attempt.expected,
        typed=attempt.typed,
        accuracy=attempt.accuracy,
        correct_words=attempt.correct_words,
        incorrect_words=attempt.incorrect_words,
    )


@router.patch("/sessions/{session_id}/finish", status_code=status.HTTP_204_NO_CONTENT)
async def finish_recall_session(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(RecallSession).where(RecallSession.id == session_id, RecallSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recall session not found")

    session.finished_at = datetime.now(timezone.utc)
    await db.commit()
