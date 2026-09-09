import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import session_repository, text_repository


async def get_overview(db: AsyncSession, user_id: uuid.UUID) -> dict:
    stats = await session_repository.overview_for_user(db, user_id)
    texts = await text_repository.list_by_user(db, user_id)

    return {
        **stats,
        "texts_count": len(texts),
        "texts_ready": sum(1 for t in texts if t.status == "ready"),
    }
