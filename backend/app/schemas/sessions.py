import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    text_id: uuid.UUID
    chunk_id: uuid.UUID


class SessionOut(BaseModel):
    id: str
    text_id: str | None
    chunk_id: str | None
    started_at: datetime
    finished_at: datetime | None
    correct_characters: int
    incorrect_characters: int
    total_characters: int
    wpm: float
    accuracy: float


class ErrorIn(BaseModel):
    expected_char: str
    typed_char: str
    position: int = Field(ge=0)
    word: str = ""
    sentence_id: uuid.UUID | None = None


class SessionFinish(BaseModel):
    correct_characters: int = Field(ge=0)
    incorrect_characters: int = Field(ge=0)
    total_characters: int = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    errors: list[ErrorIn] = []
