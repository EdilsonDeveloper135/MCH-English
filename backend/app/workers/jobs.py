import asyncio
import uuid

import redis
from rq import Queue

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.text import Sentence, Text, TextChunk
from app.services.chunking_service import build_chunks, count_words
from app.services.translation_service import realign_translation

_redis_conn = redis.from_url(settings.redis_url)
_queue = Queue("text-processing", connection=_redis_conn)


def enqueue_process_text(text_id: str) -> None:
    _queue.enqueue(process_text, text_id)


def process_text(text_id: str) -> None:
    """RQ entrypoint (sync) bridging into the async SQLAlchemy stack."""
    asyncio.run(_process_text_async(text_id))


async def _process_text_async(text_id_str: str) -> None:
    text_id = uuid.UUID(text_id_str)
    worker_engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
    worker_session_maker = async_sessionmaker(worker_engine, expire_on_commit=False)

    try:
        async with worker_session_maker() as db:
            text = await db.get(Text, text_id)
            if text is None:
                return

            text.status = "processing"
            await db.commit()

            try:
                chunks = build_chunks(text.raw_content, text.chunk_mode)

                for chunk_index, sentences in enumerate(chunks):
                    chunk = TextChunk(
                        text_id=text.id,
                        index=chunk_index,
                        word_count=sum(count_words(s) for s in sentences),
                    )
                    db.add(chunk)
                    await db.flush()  # populate chunk.id for the sentences below

                    for sentence_index, sentence_content in enumerate(sentences):
                        db.add(Sentence(chunk_id=chunk.id, index=sentence_index, content=sentence_content))

                await db.flush()  # populate sentence ids before alignment links them

                if (text.translation_content or "").strip():
                    await realign_translation(db, text)

                text.status = "ready"
                text.error_message = None
                await db.commit()
            except Exception as exc:  # noqa: BLE001 - persist failure instead of crashing the worker
                await db.rollback()
                text.status = "failed"
                text.error_message = str(exc)
                await db.commit()
    finally:
        await worker_engine.dispose()


