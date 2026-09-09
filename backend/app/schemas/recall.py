import uuid
from typing import Literal

from pydantic import BaseModel, Field

RecallMode = Literal["missing_words", "spanish_to_english"]


class BlankOut(BaseModel):
    start: int
    end: int


class RoundOut(BaseModel):
    sentence_id: str
    content: str | None = None
    blanks: list[BlankOut] | None = None
    spanish_prompt: str | None = None
    english_content: str | None = None


class RecallSessionCreate(BaseModel):
    text_id: uuid.UUID
    mode: RecallMode


class RecallSessionOut(BaseModel):
    session_id: str
    mode: RecallMode
    rounds: list[RoundOut]


class RecallAttemptCreate(BaseModel):
    recall_session_id: uuid.UUID
    sentence_id: uuid.UUID
    typed: str
    blanks: list[BlankOut] | None = None
    correct_characters: int = Field(ge=0)
    incorrect_characters: int = Field(ge=0)
    total_characters: int = Field(ge=0)
    duration_seconds: float = Field(ge=0)


class RecallAttemptOut(BaseModel):
    id: str
    expected: str
    typed: str
    accuracy: float
    correct_words: int
    incorrect_words: int
