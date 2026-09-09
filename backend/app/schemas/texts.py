from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ChunkMode = Literal["short", "normal", "long", "continuous"]
TextStatus = Literal["pending", "processing", "ready", "failed"]


class TextCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    raw_content: str = Field(min_length=1)
    chunk_mode: ChunkMode = "normal"


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
    created_at: datetime


class SentenceOut(BaseModel):
    id: str
    index: int
    content: str


class ChunkOut(BaseModel):
    id: str
    index: int
    word_count: int
    total_chunks: int
    sentences: list[SentenceOut]


class ProgressUpdate(BaseModel):
    current_chunk_index: int = Field(ge=0)
    current_character_index: int = Field(ge=0)
