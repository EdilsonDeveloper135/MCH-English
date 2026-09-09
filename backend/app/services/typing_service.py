def calculate_accuracy(correct_characters: int, total_characters: int) -> float:
    """accuracy = correct characters / characters typed * 100 (spec section 12)."""
    if total_characters <= 0:
        return 0.0
    return round((correct_characters / total_characters) * 100, 2)


def calculate_wpm(total_characters: int, duration_seconds: float) -> float:
    """WPM using the standard 5-characters-per-word convention (spec section 13)."""
    if duration_seconds <= 0:
        return 0.0
    minutes = duration_seconds / 60
    words = total_characters / 5
    return round(words / minutes, 2)
