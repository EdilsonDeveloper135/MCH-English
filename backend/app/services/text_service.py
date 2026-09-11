import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import text_repository
from app.services.chunking_service import clean_text, count_words
from app.workers.jobs import enqueue_process_text

logger = structlog.get_logger(__name__)

ENQUEUE_ERROR_MESSAGE = "No se pudo encolar el procesamiento. Borra el texto y vuelve a subirlo."


async def create_text(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    raw_content: str,
    chunk_mode: str,
    translation_content: str | None = None,
):
    cleaned = clean_text(raw_content)
    word_count = count_words(cleaned)
    text = await text_repository.create(
        db,
        user_id=user_id,
        title=title,
        raw_content=cleaned,
        chunk_mode=chunk_mode,
        word_count=word_count,
        translation_content=(translation_content or "").strip() or None,
    )

    try:
        enqueue_process_text(str(text.id))
    except Exception as exc:  # noqa: BLE001
        # The row is already committed; without this the text would sit in `pending`
        # forever with no worker ever picking it up and no way to tell from the UI.
        logger.error("text_enqueue_failed", text_id=str(text.id), error=str(exc))
        text.status = "failed"
        text.error_message = ENQUEUE_ERROR_MESSAGE
        await db.commit()

    return text
