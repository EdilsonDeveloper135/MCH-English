from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services import achievements_service

router = APIRouter()


class AchievementItemOut(BaseModel):
    id: str
    name: str
    description: str
    unlocked_at: str | None
    seen: bool


class MarkSeenResponse(BaseModel):
    status: str
    marked_count: int


@router.get("", response_model=list[AchievementItemOut])
@router.get("/", response_model=list[AchievementItemOut], include_in_schema=False)
async def list_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await achievements_service.get_user_achievements(db, current_user.id)


@router.post("/mark-seen", response_model=MarkSeenResponse)
async def mark_achievements_seen(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await achievements_service.mark_achievements_seen(db, current_user.id)
    return MarkSeenResponse(status="ok", marked_count=count)
