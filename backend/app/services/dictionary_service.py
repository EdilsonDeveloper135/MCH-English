from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dictionary import DictionaryEntry


def merge_translations(raw_translations: list[str]) -> str:
    merged: list[str] = []
    for raw in raw_translations:
        for translation in raw.split("; "):
            if translation and translation not in merged:
                merged.append(translation)
    return "; ".join(merged)


async def lookup(db: AsyncSession, word: str) -> str | None:
    normalized = word.strip().lower()
    if not normalized:
        return None

    result = await db.execute(select(DictionaryEntry).where(DictionaryEntry.headword == normalized))
    entries = result.scalars().all()
    if not entries:
        return None

    return merge_translations([entry.translations for entry in entries])


async def lookup_many(db: AsyncSession, words: list[str]) -> dict[str, str]:
    """Batched version of lookup() -- one query for the whole list instead of one per
    word, for call sites that render translations for many words at once (e.g. the
    Vocabulary list)."""
    normalized = {w.strip().lower() for w in words if w.strip()}
    if not normalized:
        return {}

    result = await db.execute(select(DictionaryEntry).where(DictionaryEntry.headword.in_(normalized)))

    by_word: dict[str, list[str]] = {}
    for entry in result.scalars().all():
        by_word.setdefault(entry.headword, []).append(entry.translations)

    return {word: merge_translations(raw) for word, raw in by_word.items()}
