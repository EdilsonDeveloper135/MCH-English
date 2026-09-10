import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dictation import DictationAttempt, DictationSession
from app.models.recall import RecallAttempt, RecallSession
from app.models.text import Text
from app.repositories import session_repository, text_repository
from app.services import vocabulary_service


async def get_overview(db: AsyncSession, user_id: uuid.UUID, texts: list[Text] | None = None) -> dict:
    """`texts` can be passed in by a caller that already fetched it (e.g.
    gamification_service, which needs the same list for its own computation) to
    avoid running the identical query twice in one request."""
    stats = await session_repository.overview_for_user(db, user_id)
    if texts is None:
        texts = await text_repository.list_by_user(db, user_id)

    recall_result = await db.execute(
        select(func.coalesce(func.avg(RecallAttempt.accuracy), 0))
        .join(RecallSession, RecallAttempt.recall_session_id == RecallSession.id)
        .where(RecallSession.user_id == user_id)
    )
    average_recall_accuracy = round(float(recall_result.scalar_one()), 2)

    dictation_result = await db.execute(
        select(func.coalesce(func.avg(DictationAttempt.accuracy), 0))
        .join(DictationSession, DictationAttempt.dictation_session_id == DictationSession.id)
        .where(DictationSession.user_id == user_id)
    )
    average_dictation_accuracy = round(float(dictation_result.scalar_one()), 2)

    sentences_completed = await session_repository.sentences_completed_for_user(db, user_id)
    count_stats = await vocabulary_service.get_count_stats(db, user_id)

    return {
        **stats,
        "texts_count": len(texts),
        "texts_ready": sum(1 for t in texts if t.status == "ready"),
        "average_recall_accuracy": average_recall_accuracy,
        "average_dictation_accuracy": average_dictation_accuracy,
        "sentences_completed": sentences_completed,
        **count_stats,
    }


async def get_history(db: AsyncSession, user_id: uuid.UUID, days: int | None = None) -> list[dict]:
    return await session_repository.history_for_user(db, user_id, days=days)


async def get_vocabulary_distribution(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    return await vocabulary_service.get_mastery_distribution(db, user_id)
