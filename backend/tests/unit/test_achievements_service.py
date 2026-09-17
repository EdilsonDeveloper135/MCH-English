from app.services.achievements_service import ACHIEVEMENTS_CATALOG


def test_achievements_catalog_contains_all_12_achievements():
    assert len(ACHIEVEMENTS_CATALOG) == 12
    ids = [ach.id for ach in ACHIEVEMENTS_CATALOG]
    expected_ids = [
        "first_session",
        "speed_30",
        "speed_60",
        "speed_90",
        "accuracy_95",
        "streak_7",
        "streak_30",
        "words_1000",
        "words_10000",
        "texts_5",
        "level_10",
        "night_owl",
    ]
    assert sorted(ids) == sorted(expected_ids)


def test_achievement_conditions():
    ach_map = {ach.id: ach for ach in ACHIEVEMENTS_CATALOG}

    # first_session
    assert ach_map["first_session"].condition({"total_sessions": 1}) is True
    assert ach_map["first_session"].condition({"total_sessions": 0}) is False

    # speed tiers
    assert ach_map["speed_30"].condition({"best_wpm": 30.0}) is True
    assert ach_map["speed_30"].condition({"best_wpm": 29.9}) is False
    assert ach_map["speed_60"].condition({"best_wpm": 60.0}) is True
    assert ach_map["speed_90"].condition({"best_wpm": 90.0}) is True

    # accuracy_95
    assert ach_map["accuracy_95"].condition({"has_accuracy_95": True}) is True
    assert ach_map["accuracy_95"].condition({"has_accuracy_95": False}) is False

    # streaks
    assert ach_map["streak_7"].condition({"streak": 7}) is True
    assert ach_map["streak_7"].condition({"streak": 6}) is False
    assert ach_map["streak_30"].condition({"streak": 30}) is True

    # words
    assert ach_map["words_1000"].condition({"total_words": 1000}) is True
    assert ach_map["words_1000"].condition({"total_words": 999}) is False
    assert ach_map["words_10000"].condition({"total_words": 10000}) is True

    # texts_5
    assert ach_map["texts_5"].condition({"distinct_texts": 5}) is True
    assert ach_map["texts_5"].condition({"distinct_texts": 4}) is False

    # level_10
    assert ach_map["level_10"].condition({"level": 10}) is True
    assert ach_map["level_10"].condition({"level": 9}) is False

    # night_owl
    assert ach_map["night_owl"].condition({"night_sessions": 5}) is True
    assert ach_map["night_owl"].condition({"night_sessions": 4}) is False
