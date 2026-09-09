from datetime import datetime

from pydantic import BaseModel


class VocabularyItemOut(BaseModel):
    word: str
    translation: str | None
    encounters: int
    typing_errors: int
    mastery_score: float
    last_seen: datetime


class WeakWordSentenceOut(BaseModel):
    id: str
    content: str


class WeakWordsSessionOut(BaseModel):
    session_id: str
    words: list[str]
    sentences: list[WeakWordSentenceOut]
