from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_sessions: int
    total_practice_seconds: float
    average_wpm: float
    average_accuracy: float
    best_wpm: float
    texts_count: int
    texts_ready: int
    average_recall_accuracy: float
