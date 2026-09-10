from datetime import date, timedelta

from app.services.gamification_service import ACHIEVEMENTS, compute_level, compute_streak, xp_for_level

TODAY = date(2026, 9, 10)


def test_compute_streak_empty():
    assert compute_streak([], TODAY) == (0, 0)


def test_compute_streak_single_day_today():
    assert compute_streak([TODAY], TODAY) == (1, 1)


def test_compute_streak_single_day_yesterday_still_counts():
    yesterday = TODAY - timedelta(days=1)
    assert compute_streak([yesterday], TODAY) == (1, 1)


def test_compute_streak_old_gap_breaks_current_but_not_longest():
    old_run = [TODAY - timedelta(days=10), TODAY - timedelta(days=9), TODAY - timedelta(days=8)]
    current, longest = compute_streak(old_run, TODAY)
    assert current == 0
    assert longest == 3


def test_compute_streak_run_ending_today():
    run = [TODAY - timedelta(days=2), TODAY - timedelta(days=1), TODAY]
    assert compute_streak(run, TODAY) == (3, 3)


def test_compute_streak_isolated_today_after_older_run():
    dates = [TODAY - timedelta(days=10), TODAY - timedelta(days=9), TODAY - timedelta(days=8), TODAY]
    current, longest = compute_streak(dates, TODAY)
    assert current == 1
    assert longest == 3


def test_xp_for_level_boundaries():
    assert xp_for_level(1) == 0
    assert xp_for_level(2) == 300
    assert xp_for_level(3) == 900
    assert xp_for_level(4) == 1800


def test_compute_level_zero_xp():
    assert compute_level(0) == {"level": 1, "total_xp": 0, "xp_into_level": 0, "xp_for_next_level": 300}


def test_compute_level_just_below_boundary():
    result = compute_level(299)
    assert result["level"] == 1
    assert result["xp_into_level"] == 299


def test_compute_level_exact_boundary():
    result = compute_level(300)
    assert result["level"] == 2
    assert result["xp_into_level"] == 0
    assert result["xp_for_next_level"] == 600


def test_compute_level_monotonic_non_decreasing():
    levels = [compute_level(xp)["level"] for xp in range(0, 3001, 100)]
    assert levels == sorted(levels)


def test_achievement_ids_are_unique():
    ids = [a.id for a in ACHIEVEMENTS]
    assert len(ids) == len(set(ids))


def test_wpm_achievement_boundary():
    wpm_50 = next(a for a in ACHIEVEMENTS if a.id == "wpm_50")
    assert wpm_50.check({"best_wpm": 50}) is True
    assert wpm_50.check({"best_wpm": 49.99}) is False
