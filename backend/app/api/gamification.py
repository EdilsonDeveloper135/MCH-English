from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories import gamification_repository, settings_repository
from app.schemas.gamification import AchievementOut, GamificationOverview
from app.services.gamification_service import ACHIEVEMENTS, get_gamification_overview

router = APIRouter()


@router.get("/overview", response_model=GamificationOverview)
async def overview(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stats = await get_gamification_overview(db, current_user.id)
    settings = await settings_repository.get_or_create(db, current_user.id)
    unlocked = await gamification_repository.get_unlocked_achievement_ids(db, current_user.id)
    today = datetime.now(timezone.utc).date()
    practice_seconds_today = await gamification_repository.practice_seconds_on(db, current_user.id, today)

    return GamificationOverview(
        level=stats["level"],
        total_xp=stats["total_xp"],
        xp_into_level=stats["xp_into_level"],
        xp_for_next_level=stats["xp_for_next_level"],
        current_streak=stats["current_streak"],
        longest_streak=stats["longest_streak"],
        daily_goal_minutes=settings.daily_goal_minutes,
        practice_seconds_today=practice_seconds_today,
        achievements=[
            AchievementOut(id=a.id, name=a.name, description=a.description, unlocked=a.id in unlocked)
            for a in ACHIEVEMENTS
        ],
    )
