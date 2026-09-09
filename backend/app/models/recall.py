import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy import Text as SAText
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecallSession(Base):
    __tablename__ = "recall_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    text_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("texts.id", ondelete="CASCADE"), nullable=False
    )
    mode: Mapped[str] = mapped_column(String(30), nullable=False)  # missing_words | spanish_to_english
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts: Mapped[list["RecallAttempt"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class RecallAttempt(Base):
    __tablename__ = "recall_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recall_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recall_sessions.id", ondelete="CASCADE"), nullable=False
    )
    sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id", ondelete="CASCADE"), nullable=False
    )
    expected: Mapped[str] = mapped_column(SAText, nullable=False)
    typed: Mapped[str] = mapped_column(SAText, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    correct_words: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_words: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["RecallSession"] = relationship(back_populates="attempts")
