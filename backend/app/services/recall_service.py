import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.text import Text
from app.repositories import text_repository
from app.services import vocabulary_service
from app.services.chunking_service import find_words_with_spans

MAX_ROUNDS = 15
MAX_BLANKS_PER_SENTENCE = 2
MIN_BLANK_WORD_LENGTH = 3  # avoid blanking tiny filler words like "a", "is"


@dataclass
class BlankRange:
    start: int
    end: int


@dataclass
class MissingWordsRound:
    sentence_id: str
    content: str
    blanks: list[BlankRange] = field(default_factory=list)


@dataclass
class SpanishToEnglishRound:
    sentence_id: str
    spanish_prompt: str
    english_content: str


def select_blanks(
    sentence_content: str, weak_words: set[str], max_blanks: int = MAX_BLANKS_PER_SENTENCE
) -> list[tuple[int, int]]:
    """Picks 1..max_blanks word spans to hide: the user's weak words found in this
    sentence first, then the longest remaining words as a no-data fallback."""
    words = find_words_with_spans(sentence_content)
    if not words:
        return []

    weak_matches = [w for w in words if w[2].lower() in weak_words]
    filler_free = [w for w in words if w[2].lower() not in weak_words and len(w[2]) >= MIN_BLANK_WORD_LENGTH]
    filler_free.sort(key=lambda w: len(w[2]), reverse=True)

    chosen = (weak_matches + filler_free)[:max_blanks]
    if not chosen:
        chosen = [max(words, key=lambda w: len(w[2]))]

    spans = sorted({(start, end) for start, end, _word in chosen})
    return spans


def score_attempt(expected: str, typed: str) -> tuple[int, int]:
    """Word-level comparison: how many of the expected words the user typed correctly,
    in the right position."""
    expected_words = expected.split()
    typed_words = typed.split()

    correct = 0
    incorrect = 0
    for i, expected_word in enumerate(expected_words):
        typed_word = typed_words[i] if i < len(typed_words) else ""
        if typed_word == expected_word:
            correct += 1
        else:
            incorrect += 1

    incorrect += max(0, len(typed_words) - len(expected_words))
    return correct, incorrect


def score_missing_words_attempt(expected_words: list[str], typed: str) -> tuple[int, int]:
    """Missing Words concatenates the blanked words with no separator (they're
    disjoint fields, not a continuous phrase -- see buildBlankTargetText on the
    frontend), so scoring slices `typed` by each expected word's length instead of
    splitting on whitespace."""
    correct = 0
    incorrect = 0
    offset = 0
    for word in expected_words:
        segment = typed[offset : offset + len(word)]
        offset += len(word)
        if segment == word:
            correct += 1
        else:
            incorrect += 1
    return correct, incorrect


WEAK_MASTERY_THRESHOLD = 70.0


async def build_missing_words_rounds(db: AsyncSession, user_id: uuid.UUID, text: Text) -> list[MissingWordsRound]:
    sentences = await text_repository.get_ordered_sentences(db, text.id)
    # get_weak_words(limit=50) returns the N lowest-mastery words regardless of how
    # low that actually is -- with a small vocabulary that's nearly everything the
    # user has typed. Only genuinely struggling words should out-prioritize the
    # longest-word fallback in select_blanks, hence the extra mastery filter here.
    weak_items = await vocabulary_service.get_weak_words(db, user_id, limit=50)
    weak_words = {item.word for item in weak_items if item.mastery_score < WEAK_MASTERY_THRESHOLD}

    rounds: list[MissingWordsRound] = []
    for sentence in sentences:
        if len(rounds) >= MAX_ROUNDS:
            break
        blanks = select_blanks(sentence.content, weak_words)
        if not blanks:
            continue
        rounds.append(
            MissingWordsRound(
                sentence_id=str(sentence.id),
                content=sentence.content,
                blanks=[BlankRange(start=s, end=e) for s, e in blanks],
            )
        )
    return rounds


async def build_spanish_to_english_rounds(db: AsyncSession, text: Text) -> list[SpanishToEnglishRound]:
    sentences = await text_repository.get_ordered_sentences(db, text.id)
    links = await text_repository.get_translation_links(db, [s.id for s in sentences])
    translation_sentences = await text_repository.get_ordered_translation_sentences(db, text.id)
    translation_by_id = {ts.id: ts for ts in translation_sentences}

    linked_by_sentence: dict[uuid.UUID, list] = {}
    for link in links:
        linked_by_sentence.setdefault(link.english_sentence_id, []).append(
            translation_by_id[link.translation_sentence_id]
        )

    rounds: list[SpanishToEnglishRound] = []
    for sentence in sentences:
        if len(rounds) >= MAX_ROUNDS:
            break
        linked = linked_by_sentence.get(sentence.id)
        if not linked:
            continue
        linked.sort(key=lambda ts: ts.index)
        rounds.append(
            SpanishToEnglishRound(
                sentence_id=str(sentence.id),
                spanish_prompt=" ".join(ts.content for ts in linked),
                english_content=sentence.content,
            )
        )
    return rounds
