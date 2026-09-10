from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import VocabularyItem
from app.repositories import session_repository
from app.schemas.vocabulary import VocabularyItemOut, WeakWordSentenceOut, WeakWordsSessionOut
from app.services import dictionary_service, vocabulary_service

router = APIRouter()


async def _to_vocabulary_outs(db: AsyncSession, items: list[VocabularyItem]) -> list[VocabularyItemOut]:
    translations = await dictionary_service.lookup_many(db, [item.word for item in items])
    return [
        VocabularyItemOut(
            word=item.word,
            translation=translations.get(item.word),
            encounters=item.encounters,
            typing_errors=item.typing_errors,
            mastery_score=item.mastery_score,
            last_seen=item.last_seen,
        )
        for item in items
    ]


@router.get("", response_model=list[VocabularyItemOut])
async def list_vocabulary(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await vocabulary_service.get_vocabulary(db, current_user.id)
    return await _to_vocabulary_outs(db, items)


@router.get("/weak", response_model=list[VocabularyItemOut])
async def list_weak_words(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await vocabulary_service.get_weak_words(db, current_user.id)
    return await _to_vocabulary_outs(db, items)


@router.post("/weak/session", response_model=WeakWordsSessionOut)
async def start_weak_words_session(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    weak_items = await vocabulary_service.get_weak_words(db, current_user.id)
    words = [item.word for item in weak_items]
    sentences = await vocabulary_service.build_weak_words_sentences(db, current_user.id, words)

    if not sentences:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay suficientes palabras debiles registradas todavia.",
        )

    session = await session_repository.create(
        db, user_id=current_user.id, review_sentence_ids=[s.id for s in sentences]
    )

    return WeakWordsSessionOut(
        session_id=str(session.id),
        words=words,
        sentences=[WeakWordSentenceOut(id=str(s.id), content=s.content) for s in sentences],
    )
