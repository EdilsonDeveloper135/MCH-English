from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dictionary import DictionaryLookupOut
from app.services import dictionary_service

router = APIRouter()


@router.get("/{word}", response_model=DictionaryLookupOut)
async def get_word(
    word: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    translations = await dictionary_service.lookup(db, word)
    if translations is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return DictionaryLookupOut(word=word, translations=translations)
