import math
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import gamification_repository, settings_repository, text_repository
from app.services import statistics_service

XP_PER_LEVEL_STEP = 300  # one normal Practice chunk (60-80 words / 300-400 correct
                          # characters) reaches level 2 -- ni instant nor eternal


def compute_streak(active_dates: list[date], today: date) -> tuple[int, int]:
    """Returns (current_streak, longest_streak) in days.

    Not having activity TODAY yet does not break the current streak (the day isn't
    over) -- only a missed *yesterday* (with nothing today either) does. A gap
    earlier in history affects longest_streak only, never current_streak. `today`
    is the user's current calendar date in their configured timezone."""
    if not active_dates:
        return 0, 0

    dates = sorted(set(active_dates))

    longest = run = 1
    for prev, curr in zip(dates, dates[1:]):
        run = run + 1 if curr == prev + timedelta(days=1) else 1
        longest = max(longest, run)

    active_set = set(dates)
    if today in active_set:
        cursor = today
    elif today - timedelta(days=1) in active_set:
        cursor = today - timedelta(days=1)
    else:
        return 0, longest

    current = 0
    while cursor in active_set:
        current += 1
        cursor -= timedelta(days=1)
    return current, longest


def xp_for_level(level: int) -> int:
    """Cumulative XP required to REACH `level` (level 1 = 0 XP)."""
    return XP_PER_LEVEL_STEP * level * (level - 1) // 2


def compute_level(total_xp: int) -> dict:
    """Closed-form triangular-curve lookup (no while-loop scanning from level 1 for
    pathologically high XP). The sqrt estimate can be off by one at exact boundaries
    due to floating point, corrected with a bounded (O(1)) adjustment."""
    total_xp = max(0, total_xp)
    estimate = (1 + math.sqrt(1 + 8 * total_xp / XP_PER_LEVEL_STEP)) / 2
    level = max(1, int(estimate))
    while xp_for_level(level + 1) <= total_xp:
        level += 1
    while xp_for_level(level) > total_xp:
        level -= 1

    floor_xp, next_floor_xp = xp_for_level(level), xp_for_level(level + 1)
    return {
        "level": level,
        "total_xp": total_xp,
        "xp_into_level": total_xp - floor_xp,
        "xp_for_next_level": next_floor_xp - floor_xp,
    }


@dataclass(frozen=True)
class Achievement:
    id: str
    name: str
    description: str
    check: Callable[[dict], bool]


ACHIEVEMENTS: list[Achievement] = [
    Achievement("first_session", "Primer paso", "Completa tu primera sesion de practica.",
                lambda s: s["total_sessions"] >= 1),
    Achievement("streak_3", "Racha de 3 dias", "Practica 3 dias seguidos.", lambda s: s["current_streak"] >= 3),
    Achievement("streak_7", "Racha de 7 dias", "Practica 7 dias seguidos.", lambda s: s["current_streak"] >= 7),
    Achievement("streak_30", "Racha de 30 dias", "Practica 30 dias seguidos.", lambda s: s["current_streak"] >= 30),
    Achievement("wpm_50", "50 WPM", "Alcanza 50 palabras por minuto.", lambda s: s["best_wpm"] >= 50),
    Achievement("wpm_80", "80 WPM", "Alcanza 80 palabras por minuto.", lambda s: s["best_wpm"] >= 80),
    Achievement("wpm_100", "100 WPM", "Alcanza 100 palabras por minuto.", lambda s: s["best_wpm"] >= 100),
    Achievement(
        "perfect_accuracy", "Precision perfecta", "Termina una sesion con 100% de precision.",
        lambda s: s["had_perfect_session"],
    ),
    Achievement("vocab_10", "10 palabras dominadas", "Domina 10 palabras.", lambda s: s["words_learned"] >= 10),
    Achievement("vocab_50", "50 palabras dominadas", "Domina 50 palabras.", lambda s: s["words_learned"] >= 50),
    Achievement("vocab_100", "100 palabras dominadas", "Domina 100 palabras.", lambda s: s["words_learned"] >= 100),
    Achievement("first_recall", "Primer Recall", "Completa tu primera sesion de Recall.",
                lambda s: s["recall_sessions_finished"] >= 1),
    Achievement("first_dictation", "Primer Dictation", "Completa tu primera sesion de Dictation.",
                lambda s: s["dictation_sessions_finished"] >= 1),
    Achievement("text_completed", "Texto completado", "Termina de practicar un texto entero.",
                lambda s: s["texts_completed"] >= 1),
    Achievement("level_10", "Nivel 10", "Alcanza el nivel 10.", lambda s: s["level"] >= 10),
]


async def get_gamification_overview(db: AsyncSession, user_id: uuid.UUID, tz_str: str | None = None) -> dict:
    """Composes on top of statistics_service.get_overview without changing its
    return shape, so /statistics/* and the Progress page stay unaffected by
    anything here."""
    texts = await text_repository.list_by_user(db, user_id)
    overview = await statistics_service.get_overview(db, user_id, texts=texts)

    if tz_str is None:
        settings = await settings_repository.get_or_create(db, user_id)
        tz_str = settings.timezone or "UTC"

    try:
        tz = ZoneInfo(tz_str)
    except (ZoneInfoNotFoundError, ValueError):
        tz = timezone.utc

    active_dates = await gamification_repository.get_active_dates(db, user_id, tz_str=tz_str)
    today = datetime.now(tz).date()
    current_streak, longest_streak = compute_streak(active_dates, today)

    typing_xp = await gamification_repository.total_typing_xp(db, user_id)
    word_xp = await gamification_repository.total_word_xp(db, user_id)
    level_info = compute_level(typing_xp + word_xp)

    texts_completed = sum(1 for t in texts if t.chunks and t.current_chunk_index >= len(t.chunks))

    return {
        **overview,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "recall_sessions_finished": await gamification_repository.recall_sessions_finished_count(db, user_id),
        "dictation_sessions_finished": await gamification_repository.dictation_sessions_finished_count(db, user_id),
        "had_perfect_session": await gamification_repository.has_perfect_accuracy_session(db, user_id),
        "texts_completed": texts_completed,
        **level_info,
    }


async def check_and_unlock_achievements(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    """Evaluates the full (small, fixed) catalog against fresh stats and persists any
    newly-true ones. Re-checking everything on every finish is intentionally simple:
    personal app, ~15 predicates, zero extra queries per predicate."""
    stats = await get_gamification_overview(db, user_id)
    already = await gamification_repository.get_unlocked_achievement_ids(db, user_id)
    newly_unlocked = [a.id for a in ACHIEVEMENTS if a.id not in already and a.check(stats)]
    if newly_unlocked:
        await gamification_repository.unlock_achievements(db, user_id, newly_unlocked)
    return newly_unlocked
