import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
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


async def record_session_words(
    db: AsyncSession, user_id: uuid.UUID, sentences: list[Sentence], error_words: set[str]
) -> None:
    """Registers every distinct word in `sentences` as one more encounter (and, for
    words in `error_words`, one more typing error). Previously did one SELECT + one
    INSERT/UPDATE per word in a Python loop (up to ~160 queries for a long chunk) --
    now does exactly one SELECT (to read prior encounters/typing_errors for words
    already tracked) plus one bulk INSERT ... ON CONFLICT DO UPDATE, regardless of how
    many words are involved."""
    words: set[str] = set()
    for sentence in sentences:
        words.update(w.lower() for w in extract_words(sentence.content))
    if not words:
        return

    result = await db.execute(
        select(
            VocabularyItem.word, VocabularyItem.encounters, VocabularyItem.typing_errors, VocabularyItem.last_error_at
        ).where(VocabularyItem.user_id == user_id, VocabularyItem.word.in_(words))
    )
    existing = {row.word: row for row in result.all()}

    now = datetime.now(timezone.utc)
    rows = []
    for word in words:
        prior = existing.get(word)
        is_error = word in error_words
        encounters = (prior.encounters if prior else 0) + 1
        typing_errors = (prior.typing_errors if prior else 0) + (1 if is_error else 0)
        rows.append(
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "word": word,
                "encounters": encounters,
                "typing_errors": typing_errors,
                "mastery_score": mastery_score(encounters, typing_errors),
                "last_seen": now,
                "last_error_at": now if is_error else (prior.last_error_at if prior else None),
            }
        )

    stmt = pg_insert(VocabularyItem).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[VocabularyItem.user_id, VocabularyItem.word],
        set_={
            "encounters": stmt.excluded.encounters,
            "typing_errors": stmt.excluded.typing_errors,
            "mastery_score": stmt.excluded.mastery_score,
            "last_seen": stmt.excluded.last_seen,
            "last_error_at": stmt.excluded.last_error_at,
        },
    )
    await db.execute(stmt)
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
    no synthetic/generated content, per the product's no-AI stance. Filters with one
    query per word directly in Postgres (word-boundary regex, `\\y` is the Postgres
    ARE equivalent of PCRE's `\\b`) instead of loading the user's entire library into
    Python and scanning it there -- words only ever come from extract_words'
    [A-Za-z0-9']+ token set, which contains no regex metacharacters in either dialect,
    so no escaping is needed."""
    if not words:
        return []

    selected: list[Sentence] = []
    selected_ids: set[uuid.UUID] = set()

    for word in words:
        remaining = max_sentences - len(selected)
        if remaining <= 0:
            break

        query = (
            select(Sentence)
            .join(TextChunk, Sentence.chunk_id == TextChunk.id)
            .join(Text, TextChunk.text_id == Text.id)
            .where(Text.user_id == user_id, Sentence.content.op("~*")(rf"\y{word}\y"))
        )
        if selected_ids:
            query = query.where(Sentence.id.not_in(selected_ids))
        query = query.limit(min(max_per_word, remaining))

        result = await db.execute(query)
        for sentence in result.scalars().all():
            selected.append(sentence)
            selected_ids.add(sentence.id)

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


async def get_weak_word_set(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    """Same weak-word bar as get_weak_words, but unlimited -- used to cross-reference
    every word in a whole chunk at once (see compute_difficult_words), not just the
    top N for a review session."""
    result = await db.execute(
        select(VocabularyItem.word).where(
            VocabularyItem.user_id == user_id,
            VocabularyItem.encounters >= MIN_ENCOUNTERS_FOR_WEAK,
            VocabularyItem.mastery_score < WEAK_MASTERY_THRESHOLD,
        )
    )
    return set(result.scalars().all())


def compute_difficult_words(sentence_content: str, weak_words: set[str]) -> list[str]:
    """Sentence's own words that are already tracked as weak for this user (spec
    section 18's difficult_words) -- a pure cross-reference of data the app already
    tracks from the user's own typing, no AI and no new input needed. Case-insensitive
    match, original casing preserved, sentence order, deduped."""
    seen: dict[str, str] = {}
    for word in extract_words(sentence_content):
        lowered = word.lower()
        if lowered in weak_words and lowered not in seen:
            seen[lowered] = word
    return list(seen.values())
