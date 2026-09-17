import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import extract, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import UserAchievement
from app.models.typing_session import TypingSession
from app.repositories import gamification_repository, settings_repository
from app.services import gamification_service


@dataclass(frozen=True)
class AchievementDef:
    id: str
    name: str
    description: str
    condition: Callable[[dict], bool]


ACHIEVEMENTS_CATALOG: list[AchievementDef] = [
    AchievementDef(
        id="first_session",
        name="Primera Vez",
        description="Completar 1 sesión de práctica.",
        condition=lambda s: s.get("total_sessions", 0) >= 1,
    ),
    AchievementDef(
        id="speed_30",
        name="Velocista I",
        description="Alcanzar WPM ≥ 30 en una sesión.",
        condition=lambda s: s.get("best_wpm", 0) >= 30,
    ),
    AchievementDef(
        id="speed_60",
        name="Velocista II",
        description="Alcanzar WPM ≥ 60 en una sesión.",
        condition=lambda s: s.get("best_wpm", 0) >= 60,
    ),
    AchievementDef(
        id="speed_90",
        name="Velocista III",
        description="Alcanzar WPM ≥ 90 en una sesión.",
        condition=lambda s: s.get("best_wpm", 0) >= 90,
    ),
    AchievementDef(
        id="accuracy_95",
        name="Perfeccionista",
        description="Alcanzar Accuracy ≥ 95% en una sesión.",
        condition=lambda s: s.get("has_accuracy_95", False),
    ),
    AchievementDef(
        id="streak_7",
        name="Semana Perfecta",
        description="7 días consecutivos con al menos 1 sesión.",
        condition=lambda s: s.get("streak", 0) >= 7,
    ),
    AchievementDef(
        id="streak_30",
        name="Mes Imparable",
        description="30 días consecutivos con práctica.",
        condition=lambda s: s.get("streak", 0) >= 30,
    ),
    AchievementDef(
        id="words_1000",
        name="Mil Palabras",
        description="1.000 palabras correctas acumuladas.",
        condition=lambda s: s.get("total_words", 0) >= 1000,
    ),
    AchievementDef(
        id="words_10000",
        name="Diez Mil",
        description="10.000 palabras correctas acumuladas.",
        condition=lambda s: s.get("total_words", 0) >= 10000,
    ),
    AchievementDef(
        id="texts_5",
        name="Bibliófilo",
        description="5 textos diferentes practicados.",
        condition=lambda s: s.get("distinct_texts", 0) >= 5,
    ),
    AchievementDef(
        id="level_10",
        name="Nivel 10",
        description="Alcanzar nivel 10 en el sistema XP.",
        condition=lambda s: s.get("level", 1) >= 10,
    ),
    AchievementDef(
        id="night_owl",
        name="Búho Nocturno",
        description="Completar 5 sesiones entre las 00:00 y las 05:00.",
        condition=lambda s: s.get("night_sessions", 0) >= 5,
    ),
]


async def collect_achievement_stats(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """Collects aggregated statistics required to evaluate the achievement catalog."""
    # Basic session stats
    agg_res = await db.execute(
        select(
            func.count(TypingSession.id),
            func.coalesce(func.max(TypingSession.wpm), 0.0),
            func.coalesce(func.sum(TypingSession.correct_characters), 0),
            func.count(func.distinct(TypingSession.text_id)),
        ).where(TypingSession.user_id == user_id, TypingSession.finished_at.is_not(None))
    )
    total_sessions, best_wpm, total_chars, distinct_texts = agg_res.one()

    # Accuracy >= 95% check
    acc_res = await db.execute(
        select(func.count(TypingSession.id)).where(
            TypingSession.user_id == user_id,
            TypingSession.finished_at.is_not(None),
            TypingSession.accuracy >= 95.0,
        )
    )
    has_accuracy_95 = (acc_res.scalar_one_or_none() or 0) > 0

    # Night sessions (started_at between 00:00 and 05:00)
    night_res = await db.execute(
        select(func.count(TypingSession.id)).where(
            TypingSession.user_id == user_id,
            TypingSession.finished_at.is_not(None),
            extract("hour", TypingSession.started_at) < 5,
        )
    )
    night_sessions = night_res.scalar_one_or_none() or 0

    # Streak calculation
    settings = await settings_repository.get_or_create(db, user_id)
    tz_str = settings.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_str)
    except (ZoneInfoNotFoundError, ValueError):
        tz = timezone.utc

    active_dates = await gamification_repository.get_active_dates(db, user_id, tz_str=tz_str)
    today = datetime.now(tz).date()
    current_streak, longest_streak = gamification_service.compute_streak(active_dates, today)
    streak = max(current_streak, longest_streak)

    # XP and Level
    typing_xp = await gamification_repository.total_typing_xp(db, user_id)
    word_xp = await gamification_repository.total_word_xp(db, user_id)
    level_info = gamification_service.compute_level(typing_xp + word_xp)

    return {
        "total_sessions": int(total_sessions),
        "best_wpm": float(best_wpm),
        "total_words": int(total_chars) // 5,
        "distinct_texts": int(distinct_texts),
        "has_accuracy_95": bool(has_accuracy_95),
        "night_sessions": int(night_sessions),
        "streak": streak,
        "level": level_info["level"],
    }


async def evaluate_and_unlock(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """Evaluates the 12 catalog conditions and unlocks any eligible new achievements.

    Returns newly unlocked achievements as a list of dicts:
    [{'id': str, 'name': str, 'description': str}]
    """
    # Find existing unlocked ids
    existing_res = await db.execute(
        select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id)
    )
    unlocked_ids = set(existing_res.scalars().all())

    stats = await collect_achievement_stats(db, user_id)

    new_unlocked: list[dict] = []
    for ach in ACHIEVEMENTS_CATALOG:
        if ach.id not in unlocked_ids:
            if ach.condition(stats):
                row = UserAchievement(
                    user_id=user_id,
                    achievement_id=ach.id,
                    seen=False,
                )
                db.add(row)
                new_unlocked.append({
                    "id": ach.id,
                    "name": ach.name,
                    "description": ach.description,
                })

    if new_unlocked:
        await db.commit()

    return new_unlocked


async def get_user_achievements(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """Returns the full catalog with each achievement's unlock date and seen status."""
    result = await db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_id)
    )
    unlocked_map = {row.achievement_id: row for row in result.scalars().all()}

    output = []
    for ach in ACHIEVEMENTS_CATALOG:
        row = unlocked_map.get(ach.id)
        output.append({
            "id": ach.id,
            "name": ach.name,
            "description": ach.description,
            "unlocked_at": row.unlocked_at.isoformat() if row and row.unlocked_at else None,
            "seen": row.seen if row else False,
        })
    return output


async def mark_achievements_seen(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Marks all unseen achievements for the user as seen."""
    stmt = (
        update(UserAchievement)
        .where(UserAchievement.user_id == user_id, UserAchievement.seen.is_(False))
        .values(seen=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount
