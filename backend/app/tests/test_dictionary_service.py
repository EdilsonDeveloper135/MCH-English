from app.services.dictionary_service import merge_translations


def test_merge_translations_deduplicates_across_entries():
    assert merge_translations(["a; b", "b; c"]) == "a; b; c"


def test_merge_translations_preserves_first_seen_order():
    assert merge_translations(["b; a", "a; c"]) == "b; a; c"


def test_merge_translations_empty_list():
    assert merge_translations([]) == ""
