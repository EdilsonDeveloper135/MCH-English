import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.typing_session import TypingSession
from app.models.user import User
from app.repositories import session_repository, text_repository
from app.schemas.sessions import SessionCreate, SessionFinish, SessionOut
from app.services.typing_service import calculate_accuracy, calculate_wpm

router = APIRouter()


def _to_session_out(session: TypingSession) -> SessionOut:
    return SessionOut(
        id=str(session.id),
        text_id=str(session.text_id),
        chunk_id=str(session.chunk_id),
        started_at=session.started_at,
        finished_at=session.finished_at,
        correct_characters=session.correct_characters,
        incorrect_characters=session.incorrect_characters,
        total_characters=session.total_characters,
        wpm=session.wpm,
        accuracy=session.accuracy,
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

    session = await session_repository.create(
        db, user_id=current_user.id, text_id=payload.text_id, chunk_id=payload.chunk_id
    )
    return _to_session_out(session)


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

    accuracy = calculate_accuracy(payload.correct_characters, payload.total_characters)
    wpm = calculate_wpm(payload.total_characters, payload.duration_seconds)

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
    )
    return _to_session_out(session)
