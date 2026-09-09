from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_sessions: int
    total_practice_seconds: float
    average_wpm: float
    average_accuracy: float
    best_wpm: float
    current_wpm: float
    total_errors: int
    texts_count: int
    texts_ready: int
    average_recall_accuracy: float
    average_dictation_accuracy: float
    words_encountered: int
    words_learned: int
    weak_words_count: int
    sentences_completed: int


class HistoryPoint(BaseModel):
    date: str
    average_wpm: float
    average_accuracy: float
    practice_seconds: float


class VocabularyBucket(BaseModel):
    range: str
    count: int
