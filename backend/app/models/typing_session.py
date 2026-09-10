import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TypingSession(Base):
    __tablename__ = "typing_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Null for a Weak Words review session, which draws sentences from across the
    # user's whole library rather than belonging to one text/chunk. Also goes null
    # (via SET NULL, not CASCADE) if the source text/chunk is later deleted -- the
    # session's own stats (correct_characters, wpm, accuracy, finished_at) live
    # directly on this row, so history/XP/streaks survive the text's deletion.
    text_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("texts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("text_chunks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Only set for a review session: the exact (real) sentence ids it was built from,
    # so vocabulary encounters can be recomputed at finish time.
    review_sentence_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    correct_characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wpm: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    # Client-measured active typing time, capped server-side at min(client value,
    # wall-clock elapsed) in session_repository.finish() -- NOT finished_at-started_at,
    # which inflates practice time if the tab is left open idle in the background.
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")

    user: Mapped["User"] = relationship(back_populates="typing_sessions")
    errors: Mapped[list["TypingError"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class TypingError(Base):
    __tablename__ = "typing_errors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("typing_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expected_char: Mapped[str] = mapped_column(String(8), nullable=False)
    typed_char: Mapped[str] = mapped_column(String(8), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    word: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    sentence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["TypingSession"] = relationship(back_populates="errors")
