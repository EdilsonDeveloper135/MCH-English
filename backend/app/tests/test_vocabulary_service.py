from app.services.vocabulary_service import bucket_mastery_scores, compute_difficult_words, mastery_score


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


def test_bucket_mastery_scores_all_buckets_present_when_empty():
    buckets = bucket_mastery_scores([])
    assert [b["range"] for b in buckets] == ["0-20", "20-40", "40-60", "60-80", "80-100"]
    assert all(b["count"] == 0 for b in buckets)


def test_bucket_mastery_scores_places_100_in_last_bucket():
    assert bucket_mastery_scores([100.0])[-1]["count"] == 1


def test_bucket_mastery_scores_boundary_goes_to_upper_bucket():
    counts = {b["range"]: b["count"] for b in bucket_mastery_scores([20.0, 40.0, 60.0, 80.0])}
    assert counts["20-40"] == 1
    assert counts["40-60"] == 1
    assert counts["60-80"] == 1
    assert counts["80-100"] == 1


def test_bucket_mastery_scores_counts_multiple_in_same_bucket():
    assert bucket_mastery_scores([5.0, 10.0, 15.0])[0]["count"] == 3


def test_compute_difficult_words_excludes_non_weak_words():
    assert compute_difficult_words("The cat sat on the mat.", {"jumped"}) == []


def test_compute_difficult_words_is_case_insensitive():
    assert compute_difficult_words("Environment matters.", {"environment"}) == ["Environment"]


def test_compute_difficult_words_dedupes_repeats():
    assert compute_difficult_words("The cat saw the cat.", {"cat"}) == ["cat"]


def test_compute_difficult_words_preserves_sentence_order():
    assert compute_difficult_words("Zebra ran before ant.", {"ant", "zebra"}) == ["Zebra", "ant"]


def test_compute_difficult_words_empty_weak_set():
    assert compute_difficult_words("Anything at all.", set()) == []
