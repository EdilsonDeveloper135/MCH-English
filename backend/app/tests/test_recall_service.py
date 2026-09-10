from app.services.recall_service import score_attempt, select_blanks


def test_select_blanks_prioritizes_weak_words():
    sentence = "Technology has transformed the way people communicate."
    blanks = select_blanks(sentence, weak_words={"transformed", "communicate"}, max_blanks=2)

    words = [sentence[start:end] for start, end in blanks]
    assert set(words) == {"transformed", "communicate"}


def test_select_blanks_falls_back_to_longest_words_without_data():
    sentence = "Technology has transformed the way people communicate."
    blanks = select_blanks(sentence, weak_words=set(), max_blanks=1)

    assert len(blanks) == 1
    start, end = blanks[0]
    word = sentence[start:end]
    assert word in {"Technology", "transformed", "communicate"}  # longest candidates


def test_select_blanks_handles_very_short_sentence():
    blanks = select_blanks("Yes.", weak_words=set(), max_blanks=2)
    assert len(blanks) == 1
    start, end = blanks[0]
    assert "Yes."[start:end] == "Yes"


def test_select_blanks_respects_max_blanks():
    sentence = "Many people enjoyed spending their afternoons outside in the warm sunshine."
    blanks = select_blanks(sentence, weak_words={"people", "spending", "afternoons", "outside"}, max_blanks=2)
    assert len(blanks) == 2


def test_score_attempt_all_correct():
    correct, incorrect = score_attempt("Technology has transformed", "Technology has transformed")
    assert (correct, incorrect) == (3, 0)


def test_score_attempt_some_incorrect():
    correct, incorrect = score_attempt("Technology has transformed", "Technology has changed")
    assert (correct, incorrect) == (2, 1)


def test_score_attempt_fewer_typed_words():
    correct, incorrect = score_attempt("Technology has transformed", "Technology has")
    assert (correct, incorrect) == (2, 1)


def test_score_attempt_extra_typed_words():
    correct, incorrect = score_attempt("Technology has transformed", "Technology has transformed today")
    assert (correct, incorrect) == (3, 1)


def test_score_attempt_missing_words_style_space_separated_blanks():
    # Missing Words rounds join blanked words with a single space (see
    # buildBlankTargetText on the frontend) and score them with this same
    # whole-sentence scorer -- typing the words correctly with a space between them
    # (the natural instinct) scores as fully correct.
    correct, incorrect = score_attempt("absolutely beautiful", "absolutely beautiful")
    assert (correct, incorrect) == (2, 0)


def test_score_attempt_missing_words_style_one_wrong():
    correct, incorrect = score_attempt("absolutely beautiful", "absolutely beatiuful")
    assert (correct, incorrect) == (1, 1)
