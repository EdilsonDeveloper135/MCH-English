from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.statistics import OverviewStats
from app.services.statistics_service import get_overview

router = APIRouter()


@router.get("/overview", response_model=OverviewStats)
async def overview(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stats = await get_overview(db, current_user.id)
    return OverviewStats(**stats)
