from app.services.vocabulary_service import mastery_score


def test_mastery_score_no_errors():
    assert mastery_score(5, 0) == 100.0


def test_mastery_score_all_errors():
    assert mastery_score(5, 5) == 0.0


def test_mastery_score_partial_errors():
    assert mastery_score(4, 1) == 75.0


def test_mastery_score_single_encounter():
    assert mastery_score(1, 0) == 100.0


def test_mastery_score_zero_encounters_defaults_to_full():
    assert mastery_score(0, 0) == 100.0


def test_mastery_score_never_negative():
    assert mastery_score(2, 3) == 0.0
