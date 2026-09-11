import uuid

from pydantic import BaseModel, Field


class DictationRoundOut(BaseModel):
    sentence_id: str
    content: str


class DictationSessionCreate(BaseModel):
    text_id: uuid.UUID


class DictationSessionOut(BaseModel):
    session_id: str
    rounds: list[DictationRoundOut]


# Same cap as Recall: one round is one sentence.
MAX_TYPED_LENGTH = 5_000


class DictationAttemptCreate(BaseModel):
    dictation_session_id: uuid.UUID
    sentence_id: uuid.UUID
    typed: str = Field(max_length=MAX_TYPED_LENGTH)
    correct_characters: int = Field(ge=0)
    incorrect_characters: int = Field(ge=0)
    total_characters: int = Field(ge=0)
    duration_seconds: float = Field(ge=0)


class DictationAttemptOut(BaseModel):
    id: str
    expected: str
    typed: str
    accuracy: float
    correct_words: int
    incorrect_words: int
