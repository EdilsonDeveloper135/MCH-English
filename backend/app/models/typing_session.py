import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TypingSession(Base):
    __tablename__ = "typing_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    text_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("texts.id", ondelete="CASCADE"), nullable=False
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("text_chunks.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    correct_characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wpm: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="typing_sessions")
    errors: Mapped[list["TypingError"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class TypingError(Base):
    __tablename__ = "typing_errors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("typing_sessions.id", ondelete="CASCADE"), nullable=False
    )
    expected_char: Mapped[str] = mapped_column(String(8), nullable=False)
    typed_char: Mapped[str] = mapped_column(String(8), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    word: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    sentence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["TypingSession"] = relationship(back_populates="errors")
