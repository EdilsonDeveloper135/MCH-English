import uuid

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.text import Sentence, SentenceTranslationLink, Text, TextChunk, TranslationSentence


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    raw_content: str,
    chunk_mode: str,
    word_count: int,
    translation_content: str | None = None,
) -> Text:
    # `chunks=[]` / `translation_sentences=[]` mark those relationships as already-loaded
    # (empty) so callers can safely read them right away without an async lazy-load.
    text = Text(
        user_id=user_id,
        title=title,
        raw_content=raw_content,
        chunk_mode=chunk_mode,
        word_count=word_count,
        translation_content=translation_content,
        chunks=[],
        translation_sentences=[],
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
        .options(
            selectinload(TextChunk.sentences)
            .selectinload(Sentence.translation_links)
            .selectinload(SentenceTranslationLink.translation_sentence),
            selectinload(TextChunk.sentences).selectinload(Sentence.phrases),
        )
    )
    return result.scalar_one_or_none()


async def get_chunk_by_id(db: AsyncSession, chunk_id: uuid.UUID, text_id: uuid.UUID) -> TextChunk | None:
    """Confirms `chunk_id` actually belongs to `text_id` -- used to reject a session
    creation request that names a chunk from a different (possibly not-owned) text."""
    result = await db.execute(select(TextChunk).where(TextChunk.id == chunk_id, TextChunk.text_id == text_id))
    return result.scalar_one_or_none()


async def get_owned_sentence(db: AsyncSession, sentence_id: uuid.UUID, user_id: uuid.UUID, text_id: uuid.UUID) -> Sentence | None:
    """Same ownership-check shape as api/dictation.py's _get_owned_sentence, scoped
    additionally to one text since these routes nest under /texts/{text_id}/..."""
    result = await db.execute(
        select(Sentence)
        .join(TextChunk, Sentence.chunk_id == TextChunk.id)
        .join(Text, TextChunk.text_id == Text.id)
        .options(selectinload(Sentence.phrases))
        .where(Sentence.id == sentence_id, Text.id == text_id, Text.user_id == user_id)
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


async def get_sentence_ids(db: AsyncSession, text_id: uuid.UUID) -> list[uuid.UUID]:
    """Ids only -- used to clean up the on-disk dictation audio of a text about to be
    deleted, where the sentence bodies are not needed."""
    result = await db.execute(
        select(Sentence.id).join(TextChunk, Sentence.chunk_id == TextChunk.id).where(TextChunk.text_id == text_id)
    )
    return list(result.scalars().all())


async def get_ordered_sentences(db: AsyncSession, text_id: uuid.UUID) -> list[Sentence]:
    result = await db.execute(
        select(Sentence)
        .join(TextChunk, Sentence.chunk_id == TextChunk.id)
        .where(TextChunk.text_id == text_id)
        .order_by(TextChunk.index, Sentence.index)
    )
    return list(result.scalars().all())


async def get_ordered_translation_sentences(db: AsyncSession, text_id: uuid.UUID) -> list[TranslationSentence]:
    result = await db.execute(
        select(TranslationSentence).where(TranslationSentence.text_id == text_id).order_by(TranslationSentence.index)
    )
    return list(result.scalars().all())


async def get_translation_links(
    db: AsyncSession, english_sentence_ids: list[uuid.UUID]
) -> list[SentenceTranslationLink]:
    if not english_sentence_ids:
        return []
    result = await db.execute(
        select(SentenceTranslationLink).where(
            SentenceTranslationLink.english_sentence_id.in_(english_sentence_ids)
        )
    )
    return list(result.scalars().all())


async def replace_translation_links(
    db: AsyncSession,
    text: Text,
    english_sentences: list[Sentence],
    translation_sentences: list[TranslationSentence],
    links: list[tuple[int, int]],
) -> None:
    """Overwrites all links for `text` from (english_index, spanish_index) position
    pairs (positions into the given ordered lists), and marks alignment confirmed."""
    english_ids = [s.id for s in english_sentences]
    if english_ids:
        await db.execute(
            sa_delete(SentenceTranslationLink).where(
                SentenceTranslationLink.english_sentence_id.in_(english_ids)
            )
        )

    for english_index, spanish_index in links:
        db.add(
            SentenceTranslationLink(
                english_sentence_id=english_sentences[english_index].id,
                translation_sentence_id=translation_sentences[spanish_index].id,
            )
        )

    text.alignment_status = "confirmed"
    await db.commit()
