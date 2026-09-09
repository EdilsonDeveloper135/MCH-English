import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.text import Sentence, Text, TextChunk
from app.models.vocabulary import VocabularyItem
from app.services.chunking_service import extract_words

MIN_ENCOUNTERS_FOR_WEAK = 2
WEAK_MASTERY_THRESHOLD = 70.0
MASTERED_THRESHOLD = 80.0
MASTERY_BUCKET_RANGES = ["0-20", "20-40", "40-60", "60-80", "80-100"]


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


def bucket_mastery_scores(scores: list[float]) -> list[dict]:
    """Buckets mastery scores into 5 fixed 20-point ranges for the Vocabulary mastery
    chart (spec section 32). Always returns all 5 buckets in order, count 0 if empty.
    100.0 (the default for a never-mistyped word) falls in the last bucket."""
    counts = [0] * len(MASTERY_BUCKET_RANGES)
    for score in scores:
        clamped = max(0.0, min(100.0, score))
        index = min(int(clamped // 20), len(MASTERY_BUCKET_RANGES) - 1)
        counts[index] += 1
    return [{"range": label, "count": count} for label, count in zip(MASTERY_BUCKET_RANGES, counts)]


async def get_count_stats(db: AsyncSession, user_id: uuid.UUID) -> dict:
    result = await db.execute(
        select(
            func.count(VocabularyItem.id),
            func.count(case((VocabularyItem.mastery_score >= MASTERED_THRESHOLD, 1))),
            func.count(
                case(
                    (
                        and_(
                            VocabularyItem.encounters >= MIN_ENCOUNTERS_FOR_WEAK,
                            VocabularyItem.mastery_score < WEAK_MASTERY_THRESHOLD,
                        ),
                        1,
                    )
                )
            ),
        ).where(VocabularyItem.user_id == user_id)
    )
    words_encountered, words_learned, weak_words_count = result.one()
    return {
        "words_encountered": words_encountered,
        "words_learned": words_learned,
        "weak_words_count": weak_words_count,
    }


async def get_mastery_distribution(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    result = await db.execute(select(VocabularyItem.mastery_score).where(VocabularyItem.user_id == user_id))
    scores = list(result.scalars().all())
    return bucket_mastery_scores(scores)
