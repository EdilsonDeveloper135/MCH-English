import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import text_repository
from app.services.chunking_service import clean_text, count_words
from app.workers.jobs import enqueue_process_text


async def create_text(db: AsyncSession, *, user_id: uuid.UUID, title: str, raw_content: str, chunk_mode: str):
    cleaned = clean_text(raw_content)
    word_count = count_words(cleaned)
    text = await text_repository.create(
        db, user_id=user_id, title=title, raw_content=cleaned, chunk_mode=chunk_mode, word_count=word_count
    )
    enqueue_process_text(str(text.id))
    return text
