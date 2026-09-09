import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VocabularyItem(Base):
    """Tracks how often a user has encountered a word while typing and how often they
    mistype it. Translations are resolved on demand from dictionary_entries (see
    dictionary_service.lookup) instead of being duplicated here."""

    __tablename__ = "vocabulary_items"
    __table_args__ = (UniqueConstraint("user_id", "word", name="uq_vocabulary_items_user_word"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    word: Mapped[str] = mapped_column(String(255), nullable=False)
    encounters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    typing_errors: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mastery_score: Mapped[float] = mapped_column(Float, nullable=False, default=100)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
