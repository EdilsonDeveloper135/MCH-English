import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recall import RecallAttempt, RecallSession
from app.repositories import session_repository, text_repository


async def get_overview(db: AsyncSession, user_id: uuid.UUID) -> dict:
    stats = await session_repository.overview_for_user(db, user_id)
    texts = await text_repository.list_by_user(db, user_id)

    recall_result = await db.execute(
        select(func.coalesce(func.avg(RecallAttempt.accuracy), 0))
        .join(RecallSession, RecallAttempt.recall_session_id == RecallSession.id)
        .where(RecallSession.user_id == user_id)
    )
    average_recall_accuracy = round(float(recall_result.scalar_one()), 2)

    return {
        **stats,
        "texts_count": len(texts),
        "texts_ready": sum(1 for t in texts if t.status == "ready"),
        "average_recall_accuracy": average_recall_accuracy,
    }
