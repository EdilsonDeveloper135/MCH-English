import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.text import Sentence, Text, TextChunk
from app.models.vocabulary import VocabularyItem
from app.services.chunking_service import extract_words

MIN_ENCOUNTERS_FOR_WEAK = 2


def mastery_score(encounters: int, typing_errors: int) -> float:
    """0-100, plain accuracy rate over all encounters. No recency weighting yet --
    kept deliberately simple (spec section 22 warns against over-engineering this)."""
    if encounters <= 0:
        return 100.0
    score = 100 * (encounters - typing_errors) / encounters
    return round(max(0.0, min(100.0, score)), 1)


async def _get_or_create(db: AsyncSession, user_id: uuid.UUID, word: str) -> VocabularyItem:
    result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.user_id == user_id, VocabularyItem.word == word)
    )
    item = result.scalar_one_or_none()
    if item is None:
        item = VocabularyItem(user_id=user_id, word=word, encounters=0, typing_errors=0)
        db.add(item)
        await db.flush()
    return item


async def record_session_words(
    db: AsyncSession, user_id: uuid.UUID, sentences: list[Sentence], error_words: set[str]
) -> None:
    words: set[str] = set()
    for sentence in sentences:
        words.update(w.lower() for w in extract_words(sentence.content))

    now = datetime.now(timezone.utc)
    for word in words:
        item = await _get_or_create(db, user_id, word)
        item.encounters += 1
        item.last_seen = now
        if word in error_words:
            item.typing_errors += 1
            item.last_error_at = now
        item.mastery_score = mastery_score(item.encounters, item.typing_errors)

    await db.commit()


async def get_vocabulary(db: AsyncSession, user_id: uuid.UUID) -> list[VocabularyItem]:
    result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.user_id == user_id).order_by(VocabularyItem.mastery_score.asc())
    )
    return list(result.scalars().all())


async def get_weak_words(db: AsyncSession, user_id: uuid.UUID, limit: int = 10) -> list[VocabularyItem]:
    result = await db.execute(
        select(VocabularyItem)
        .where(VocabularyItem.user_id == user_id, VocabularyItem.encounters >= MIN_ENCOUNTERS_FOR_WEAK)
        .order_by(VocabularyItem.mastery_score.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def build_weak_words_sentences(
    db: AsyncSession,
    user_id: uuid.UUID,
    words: list[str],
    max_sentences: int = 15,
    max_per_word: int = 2,
) -> list[Sentence]:
    """Picks real sentences from the user's own library that contain the given words --
    no synthetic/generated content, per the product's no-AI stance."""
    if not words:
        return []

    result = await db.execute(
        select(Sentence)
        .join(TextChunk, Sentence.chunk_id == TextChunk.id)
        .join(Text, TextChunk.text_id == Text.id)
        .where(Text.user_id == user_id)
    )
    all_sentences = list(result.scalars().all())

    selected: list[Sentence] = []
    selected_ids: set[uuid.UUID] = set()

    for word in words:
        if len(selected) >= max_sentences:
            break
        pattern = re.compile(rf"\b{re.escape(word)}\b", re.IGNORECASE)
        matches_for_word = 0
        for sentence in all_sentences:
            if len(selected) >= max_sentences or matches_for_word >= max_per_word:
                break
            if sentence.id in selected_ids:
                continue
            if pattern.search(sentence.content):
                selected.append(sentence)
                selected_ids.add(sentence.id)
                matches_for_word += 1

    return selected
