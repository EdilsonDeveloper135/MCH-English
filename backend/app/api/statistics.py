from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.statistics import HistoryPoint, OverviewStats, VocabularyBucket
from app.services.statistics_service import get_history, get_overview, get_vocabulary_distribution

router = APIRouter()


@router.get("/overview", response_model=OverviewStats)
async def overview(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stats = await get_overview(db, current_user.id)
    return OverviewStats(**stats)


@router.get("/history", response_model=list[HistoryPoint])
async def history(
    # Bounded: an unchecked value went straight into timedelta(days=...) and raised
    # OverflowError (a 500) for anything past ~999999999.
    days: int | None = Query(default=None, ge=1, le=3650),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    points = await get_history(db, current_user.id, days=days)
    return [HistoryPoint(**p) for p in points]


@router.get("/vocabulary-distribution", response_model=list[VocabularyBucket])
async def vocabulary_distribution(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    buckets = await get_vocabulary_distribution(db, current_user.id)
    return [VocabularyBucket(**b) for b in buckets]
