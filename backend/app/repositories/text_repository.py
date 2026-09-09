import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.text import Sentence, Text, TextChunk


async def create(
    db: AsyncSession, *, user_id: uuid.UUID, title: str, raw_content: str, chunk_mode: str, word_count: int
) -> Text:
    # `chunks=[]` marks the relationship as already-loaded (empty) so callers can
    # safely read `text.chunks` right away without triggering an async lazy-load.
    text = Text(
        user_id=user_id,
        title=title,
        raw_content=raw_content,
        chunk_mode=chunk_mode,
        word_count=word_count,
        chunks=[],
    )
    db.add(text)
    await db.commit()
    return text


async def list_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Text]:
    result = await db.execute(
        select(Text)
        .where(Text.user_id == user_id)
        .options(selectinload(Text.chunks))
        .order_by(Text.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, text_id: uuid.UUID, user_id: uuid.UUID) -> Text | None:
    result = await db.execute(
        select(Text).where(Text.id == text_id, Text.user_id == user_id).options(selectinload(Text.chunks))
    )
    return result.scalar_one_or_none()


async def delete(db: AsyncSession, text: Text) -> None:
    await db.delete(text)
    await db.commit()


async def get_chunk(db: AsyncSession, text_id: uuid.UUID, index: int) -> TextChunk | None:
    result = await db.execute(
        select(TextChunk)
        .where(TextChunk.text_id == text_id, TextChunk.index == index)
        .options(selectinload(TextChunk.sentences))
    )
    return result.scalar_one_or_none()


async def update_progress(db: AsyncSession, text: Text, chunk_index: int, character_index: int) -> Text:
    text.current_chunk_index = chunk_index
    text.current_character_index = character_index
    await db.commit()
    return text


async def set_status(db: AsyncSession, text_id: uuid.UUID, status: str, error_message: str | None = None) -> None:
    text = await db.get(Text, text_id)
    if text is None:
        return
    text.status = status
    text.error_message = error_message
    await db.commit()
