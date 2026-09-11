import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


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


# Mirrors the column widths in models/typing_session.py. Values are clipped rather
# than rejected: a single over-long token in the source text must not make the whole
# finished session unsavable (it used to raise a 500 from Postgres).
MAX_CHAR_FIELD = 8
MAX_WORD_LENGTH = 255
MAX_ERRORS_PER_SESSION = 10_000


class ErrorIn(BaseModel):
    expected_char: str
    typed_char: str
    position: int = Field(ge=0)
    word: str = ""
    sentence_id: uuid.UUID | None = None

    @field_validator("expected_char", "typed_char", mode="before")
    @classmethod
    def _clip_char(cls, value: object) -> str:
        return str(value or "")[:MAX_CHAR_FIELD]

    @field_validator("word", mode="before")
    @classmethod
    def _clip_word(cls, value: object) -> str:
        return str(value or "")[:MAX_WORD_LENGTH]


class SessionFinish(BaseModel):
    correct_characters: int = Field(ge=0)
    incorrect_characters: int = Field(ge=0)
    total_characters: int = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    errors: list[ErrorIn] = Field(default_factory=list, max_length=MAX_ERRORS_PER_SESSION)
