from app.services.alignment_service import align


def test_align_one_to_one_pairs():
    english = [
        "The weather has been absolutely beautiful this entire week according to everyone.",
        "Many people enjoyed spending their afternoons outside in the warm sunshine.",
    ]
    spanish = [
        "El clima ha sido absolutamente hermoso durante toda esta semana segun todos.",
        "Muchas personas disfrutaron pasar sus tardes afuera bajo el calido sol.",
    ]

    beads = align(english, spanish)

    assert [b.english_indices for b in beads] == [[0], [1]]
    assert [b.spanish_indices for b in beads] == [[0], [1]]


def test_align_merges_two_english_sentences_into_one_spanish_sentence():
    english = ["The cat sat.", "It was happy."]
    spanish = ["El gato se sento y estaba feliz."]

    beads = align(english, spanish)

    assert len(beads) == 1
    assert beads[0].english_indices == [0, 1]
    assert beads[0].spanish_indices == [0]


def test_align_splits_one_english_sentence_into_two_spanish_sentences():
    english = ["The cat sat and was happy."]
    spanish = ["El gato se sento.", "Estaba feliz."]

    beads = align(english, spanish)

    assert len(beads) == 1
    assert beads[0].english_indices == [0]
    assert beads[0].spanish_indices == [0, 1]


def test_align_flags_an_english_sentence_with_no_translation_as_unmatched():
    english = [
        "The weather has been absolutely beautiful this entire week according to everyone.",
        "Yes.",
        "Many people enjoyed spending their afternoons outside in the warm sunshine.",
    ]
    spanish = [
        "El clima ha sido absolutamente hermoso durante toda esta semana segun todos.",
        "Muchas personas disfrutaron pasar sus tardes afuera bajo el calido sol.",
    ]

    beads = align(english, spanish)

    assert [b.english_indices for b in beads] == [[0], [1], [2]]
    assert [b.spanish_indices for b in beads] == [[0], [], [1]]


def test_align_handles_empty_translation():
    beads = align(["One.", "Two."], [])

    assert [b.english_indices for b in beads] == [[0], [1]]
    assert all(b.spanish_indices == [] for b in beads)


def test_align_handles_both_empty():
    assert align([], []) == []
