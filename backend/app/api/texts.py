import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.text import Text
from app.models.user import User
from app.repositories import text_repository
from app.schemas.texts import ChunkOut, ProgressUpdate, SentenceOut, TextCreate, TextOut
from app.services.text_service import create_text

router = APIRouter()


def _to_text_out(text: Text) -> TextOut:
    total_chunks = len(text.chunks)
    progress = (text.current_chunk_index / total_chunks * 100) if total_chunks else 0.0
    return TextOut(
        id=str(text.id),
        title=text.title,
        status=text.status,
        chunk_mode=text.chunk_mode,
        word_count=text.word_count,
        chunk_count=total_chunks,
        current_chunk_index=text.current_chunk_index,
        current_character_index=text.current_character_index,
        progress_percent=round(progress, 1),
        error_message=text.error_message,
        created_at=text.created_at,
    )


@router.post("", response_model=TextOut, status_code=status.HTTP_201_CREATED)
async def create(
    payload: TextCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await create_text(
        db,
        user_id=current_user.id,
        title=payload.title,
        raw_content=payload.raw_content,
        chunk_mode=payload.chunk_mode,
    )
    return _to_text_out(text)


@router.get("", response_model=list[TextOut])
async def list_texts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    texts = await text_repository.list_by_user(db, current_user.id)
    return [_to_text_out(t) for t in texts]


@router.get("/{text_id}", response_model=TextOut)
async def get_text(
    text_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")
    return _to_text_out(text)


@router.delete("/{text_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_text(
    text_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")
    await text_repository.delete(db, text)


@router.get("/{text_id}/chunks/{index}", response_model=ChunkOut)
async def get_chunk(
    text_id: uuid.UUID,
    index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    chunk = await text_repository.get_chunk(db, text_id, index)
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chunk not found")

    return ChunkOut(
        id=str(chunk.id),
        index=chunk.index,
        word_count=chunk.word_count,
        total_chunks=len(text.chunks),
        sentences=[SentenceOut(id=str(s.id), index=s.index, content=s.content) for s in chunk.sentences],
    )


@router.patch("/{text_id}/progress", response_model=TextOut)
async def update_progress(
    text_id: uuid.UUID,
    payload: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    text = await text_repository.update_progress(
        db, text, payload.current_chunk_index, payload.current_character_index
    )
    return _to_text_out(text)
