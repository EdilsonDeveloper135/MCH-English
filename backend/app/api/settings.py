from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories import settings_repository
from app.schemas.settings import UserSettingsOut, UserSettingsUpdate

router = APIRouter()


@router.get("", response_model=UserSettingsOut)
async def get_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings = await settings_repository.get_or_create(db, current_user.id)
    return UserSettingsOut(
        translation_mode=settings.translation_mode,
        daily_goal_minutes=settings.daily_goal_minutes,
        timezone=settings.timezone,
    )


@router.patch("", response_model=UserSettingsOut)
async def update_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await settings_repository.get_or_create(db, current_user.id)
    settings = await settings_repository.update(
        db,
        settings,
        translation_mode=payload.translation_mode,
        daily_goal_minutes=payload.daily_goal_minutes,
        timezone=payload.timezone,
    )
    return UserSettingsOut(
        translation_mode=settings.translation_mode,
        daily_goal_minutes=settings.daily_goal_minutes,
        timezone=settings.timezone,
    )
