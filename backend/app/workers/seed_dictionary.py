"""One-time loader for the bundled FreeDict eng-spa dictionary (see backend/data/NOTICE.md).
Traditional lexicographic data only -- no AI/translation model involved anywhere. Safe
to run repeatedly: skips work once dictionary_entries is already populated.

Run inside the backend container: `python -m app.workers.seed_dictionary`
"""

import asyncio
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterator

from sqlalchemy import func, select

from app.core.database import async_session_maker
from app.models.dictionary import DictionaryEntry

_TEI_NS = "{http://www.tei-c.org/ns/1.0}"
_XML_NS = "{http://www.w3.org/XML/1998/namespace}"
_DICT_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "freedict-eng-spa.tei"
_BATCH_SIZE = 2000


def _parse_entries(path: Path) -> Iterator[tuple[str, str | None, str]]:
    root = ET.parse(path).getroot()

    for entry in root.iter(f"{_TEI_NS}entry"):
        orth = entry.find(f"{_TEI_NS}form/{_TEI_NS}orth")
        headword = (orth.text or "").strip() if orth is not None else ""
        if not headword:
            continue

        pos_el = entry.find(f"{_TEI_NS}gramGrp/{_TEI_NS}pos")
        part_of_speech = pos_el.text.strip() if pos_el is not None and pos_el.text else None

        translations: list[str] = []
        for sense in entry.findall(f"{_TEI_NS}sense"):
            for cit in sense.findall(f"{_TEI_NS}cit"):
                if cit.get("type") != "trans" or cit.get(f"{_XML_NS}lang") != "es":
                    continue
                for quote in cit.findall(f"{_TEI_NS}quote"):
                    text = (quote.text or "").strip()
                    if text and text not in translations:
                        translations.append(text)

        if translations:
            yield headword.lower(), part_of_speech, "; ".join(translations)


async def seed() -> None:
    async with async_session_maker() as db:
        existing = await db.scalar(select(func.count()).select_from(DictionaryEntry))
        if existing:
            print(f"dictionary_entries already has {existing} rows, skipping seed.")
            return

        if not _DICT_PATH.exists():
            print(f"dictionary file not found at {_DICT_PATH}, skipping seed.")
            return

        batch: list[DictionaryEntry] = []
        total = 0
        for headword, part_of_speech, translations in _parse_entries(_DICT_PATH):
            batch.append(DictionaryEntry(headword=headword, part_of_speech=part_of_speech, translations=translations))
            if len(batch) >= _BATCH_SIZE:
                db.add_all(batch)
                await db.commit()
                total += len(batch)
                batch = []

        if batch:
            db.add_all(batch)
            await db.commit()
            total += len(batch)

        print(f"seeded {total} dictionary entries.")


if __name__ == "__main__":
    asyncio.run(seed())
