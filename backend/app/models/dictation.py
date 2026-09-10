import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, LargeBinary, String
from sqlalchemy import Text as SAText
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DictationAudio(Base):
    """Cached eSpeak-NG WAV output for a sentence, keyed one-per-sentence (speed is
    handled client-side via the <audio> element's playbackRate, so no per-speed
    variants are needed)."""

    __tablename__ = "dictation_audio_cache"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    audio_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DictationSession(Base):
    __tablename__ = "dictation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("texts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts: Mapped[list["DictationAttempt"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class DictationAttempt(Base):
    __tablename__ = "dictation_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dictation_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dictation_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expected: Mapped[str] = mapped_column(SAText, nullable=False)
    typed: Mapped[str] = mapped_column(SAText, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    correct_words: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_words: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["DictationSession"] = relationship(back_populates="attempts")
