import uuid

from sqlalchemy import Index, String
from sqlalchemy import Text as SAText
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DictionaryEntry(Base):
    """A traditional (non-AI) English->Spanish dictionary entry, loaded once from the
    bundled FreeDict eng-spa data (see app/workers/seed_dictionary.py). A headword can
    have more than one row (one per part of speech), so lookups aggregate all matches.
    """

    __tablename__ = "dictionary_entries"
    __table_args__ = (Index("ix_dictionary_entries_headword", "headword"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    headword: Mapped[str] = mapped_column(String(255), nullable=False)
    part_of_speech: Mapped[str | None] = mapped_column(String(50), nullable=True)
    translations: Mapped[str] = mapped_column(SAText, nullable=False)
