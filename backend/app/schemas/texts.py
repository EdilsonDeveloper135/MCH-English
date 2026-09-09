from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ChunkMode = Literal["short", "normal", "long", "continuous"]
TextStatus = Literal["pending", "processing", "ready", "failed"]
AlignmentStatus = Literal["not_provided", "needs_review", "confirmed"]


class TextCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    raw_content: str = Field(min_length=1)
    chunk_mode: ChunkMode = "normal"
    translation_content: str | None = None


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


class SentenceOut(BaseModel):
    id: str
    index: int
    content: str
    translation: str | None = None


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
    translation_content: str = Field(min_length=1)


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
