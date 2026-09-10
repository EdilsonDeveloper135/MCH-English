from pydantic import BaseModel


class AchievementOut(BaseModel):
    id: str
    name: str
    description: str
    unlocked: bool


class GamificationOverview(BaseModel):
    level: int
    total_xp: int
    xp_into_level: int
    xp_for_next_level: int
    current_streak: int
    longest_streak: int
    daily_goal_minutes: int
    practice_seconds_today: float
    achievements: list[AchievementOut]
