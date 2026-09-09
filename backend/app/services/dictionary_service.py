from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dictionary import DictionaryEntry


async def lookup(db: AsyncSession, word: str) -> str | None:
    normalized = word.strip().lower()
    if not normalized:
        return None

    result = await db.execute(select(DictionaryEntry).where(DictionaryEntry.headword == normalized))
    entries = result.scalars().all()
    if not entries:
        return None

    merged: list[str] = []
    for entry in entries:
        for translation in entry.translations.split("; "):
            if translation and translation not in merged:
                merged.append(translation)

    return "; ".join(merged)
