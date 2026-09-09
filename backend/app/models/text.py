import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy import Text as SAText
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Text(Base):
    __tablename__ = "texts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_content: Mapped[str] = mapped_column(SAText, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    chunk_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_character_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(SAText, nullable=True)
    # User-supplied Spanish translation of the whole text (no AI/MT involved anywhere).
    translation_content: Mapped[str | None] = mapped_column(SAText, nullable=True)
    # not_provided | needs_review | confirmed
    alignment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_provided")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="texts")
    chunks: Mapped[list["TextChunk"]] = relationship(
        back_populates="text", cascade="all, delete-orphan", order_by="TextChunk.index"
    )
    translation_sentences: Mapped[list["TranslationSentence"]] = relationship(
        back_populates="text", cascade="all, delete-orphan", order_by="TranslationSentence.index"
    )


class TextChunk(Base):
    __tablename__ = "text_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("texts.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    text: Mapped["Text"] = relationship(back_populates="chunks")
    sentences: Mapped[list["Sentence"]] = relationship(
        back_populates="chunk", cascade="all, delete-orphan", order_by="Sentence.index"
    )


class Sentence(Base):
    __tablename__ = "sentences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("text_chunks.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(SAText, nullable=False)

    chunk: Mapped["TextChunk"] = relationship(back_populates="sentences")
    translation_links: Mapped[list["SentenceTranslationLink"]] = relationship(
        back_populates="english_sentence", cascade="all, delete-orphan"
    )


class TranslationSentence(Base):
    """A sentence from the user-supplied Spanish translation (section-independent of
    English chunking; only alignment links it back to specific English sentences)."""

    __tablename__ = "translation_sentences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("texts.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(SAText, nullable=False)

    text: Mapped["Text"] = relationship(back_populates="translation_sentences")
    english_links: Mapped[list["SentenceTranslationLink"]] = relationship(back_populates="translation_sentence")


class SentenceTranslationLink(Base):
    """Many-to-many link between English sentences and Spanish translation sentences,
    so a real translation's merges/splits (2 EN sentences -> 1 ES sentence, etc.) can
    be represented exactly instead of assuming a strict 1:1 correspondence."""

    __tablename__ = "sentence_translation_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    english_sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sentences.id", ondelete="CASCADE"), nullable=False
    )
    translation_sentence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("translation_sentences.id", ondelete="CASCADE"), nullable=False
    )

    english_sentence: Mapped["Sentence"] = relationship(back_populates="translation_links")
    translation_sentence: Mapped["TranslationSentence"] = relationship(back_populates="english_links")
