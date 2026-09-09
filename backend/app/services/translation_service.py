from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.text import Sentence, SentenceTranslationLink, Text, TextChunk, TranslationSentence
from app.services.alignment_service import align
from app.services.chunking_service import split_into_sentences


async def realign_translation(db: AsyncSession, text: Text) -> None:
    """(Re)builds translation_sentences + sentence_translation_links for `text` from its
    current `translation_content`, against its EXISTING English sentences (chunks are
    never touched, so in-progress typing sessions/positions stay valid). Safe to call
    both right after initial chunking and later, when the user edits the translation."""
    await db.execute(delete(TranslationSentence).where(TranslationSentence.text_id == text.id))

    translation_text = (text.translation_content or "").strip()
    if not translation_text:
        text.alignment_status = "not_provided"
        await db.commit()
        return

    result = await db.execute(
        select(Sentence)
        .join(TextChunk, Sentence.chunk_id == TextChunk.id)
        .where(TextChunk.text_id == text.id)
        .order_by(TextChunk.index, Sentence.index)
    )
    english_sentences = list(result.scalars().all())

    spanish_contents = split_into_sentences(translation_text)
    translation_sentences = [
        TranslationSentence(text_id=text.id, index=idx, content=content)
        for idx, content in enumerate(spanish_contents)
    ]
    db.add_all(translation_sentences)
    await db.flush()

    beads = align([s.content for s in english_sentences], spanish_contents)

    for bead in beads:
        for en_idx in bead.english_indices:
            for es_idx in bead.spanish_indices:
                db.add(
                    SentenceTranslationLink(
                        english_sentence_id=english_sentences[en_idx].id,
                        translation_sentence_id=translation_sentences[es_idx].id,
                    )
                )

    text.alignment_status = "needs_review"
    await db.commit()
