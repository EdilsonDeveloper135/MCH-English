from app.services.typing_service import calculate_accuracy, calculate_wpm


def test_calculate_accuracy_typical():
    # 950 correct out of 1000 typed characters -> 95% (spec section 12 example)
    assert calculate_accuracy(950, 1000) == 95.0


def test_calculate_accuracy_zero_typed():
    assert calculate_accuracy(0, 0) == 0.0


def test_calculate_wpm_typical():
    # 1500 characters in 10 minutes -> 30 WPM (spec section 13 example)
    assert calculate_wpm(1500, 10 * 60) == 30.0


def test_calculate_wpm_zero_duration():
    assert calculate_wpm(100, 0) == 0.0
