from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ChunkMode = Literal["short", "normal", "long", "continuous"]
TextStatus = Literal["pending", "processing", "ready", "failed"]
AlignmentStatus = Literal["not_provided", "needs_review", "confirmed"]

# ~20,000 words -- generous for a single practice text, but bounded so a huge payload
# can't exhaust worker memory during chunking/alignment or flood the DB with rows.
MAX_TEXT_LENGTH = 100_000


class TextCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    raw_content: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    chunk_mode: ChunkMode = "normal"
    translation_content: str | None = Field(default=None, max_length=MAX_TEXT_LENGTH)

    @field_validator("title", "raw_content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("translation_content")
    @classmethod
    def _translation_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value


class TextOut(BaseModel):
    id: str
    title: str
    status: TextStatus
    chunk_mode: ChunkMode
    word_count: int
    chunk_count: int = 0
    current_chunk_index: int
    current_character_index: int
    progress_percent: float = 0
    error_message: str | None = None
    has_translation: bool = False
    alignment_status: AlignmentStatus = "not_provided"
    created_at: datetime


class PhraseOut(BaseModel):
    id: str
    english_phrase: str
    spanish_phrase: str


class PhraseCreate(BaseModel):
    english_phrase: str = Field(min_length=1, max_length=255)
    spanish_phrase: str = Field(min_length=1, max_length=255)


class GrammarNoteUpdate(BaseModel):
    grammar_note: str | None = Field(default=None, max_length=2000)


class SentenceOut(BaseModel):
    id: str
    index: int
    content: str
    translation: str | None = None
    grammar_note: str | None = None
    phrases: list[PhraseOut] = []
    difficult_words: list[str] = []


class ChunkOut(BaseModel):
    id: str
    index: int
    word_count: int
    total_chunks: int
    sentences: list[SentenceOut]


class ProgressUpdate(BaseModel):
    current_chunk_index: int = Field(ge=0)
    current_character_index: int = Field(ge=0)


class TranslationUpdate(BaseModel):
    translation_content: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)

    @field_validator("translation_content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value


class AlignmentSentenceOut(BaseModel):
    index: int
    content: str


class AlignmentLink(BaseModel):
    english_index: int = Field(ge=0)
    spanish_index: int = Field(ge=0)


class AlignmentOut(BaseModel):
    alignment_status: AlignmentStatus
    english_sentences: list[AlignmentSentenceOut]
    spanish_sentences: list[AlignmentSentenceOut]
    links: list[AlignmentLink]


class AlignmentUpdate(BaseModel):
    links: list[AlignmentLink]
