from app.services.chunking_service import build_chunks, count_words, split_sentences


def test_split_sentences_handles_abbreviations():
    paragraph = "Mr. Smith went home. He was tired."
    sentences = split_sentences(paragraph)
    assert sentences == ["Mr. Smith went home.", "He was tired."]


def test_split_sentences_basic():
    paragraph = "This is one sentence. This is another one!"
    assert split_sentences(paragraph) == ["This is one sentence.", "This is another one!"]


def test_build_chunks_never_splits_mid_sentence():
    text = (
        "Learning a new language requires consistent practice. "
        "It also requires exposure to different situations.\n\n"
        "Technology has transformed the way people communicate. "
        "It has changed how people work and learn."
    )
    chunks = build_chunks(text, "short")

    all_sentences = [s for chunk in chunks for s in chunk]
    assert all_sentences == [
        "Learning a new language requires consistent practice.",
        "It also requires exposure to different situations.",
        "Technology has transformed the way people communicate.",
        "It has changed how people work and learn.",
    ]


def test_build_chunks_continuous_mode_returns_single_chunk():
    text = "First sentence here. Second sentence here.\n\nThird paragraph sentence."
    chunks = build_chunks(text, "continuous")
    assert len(chunks) == 1
    assert count_words(" ".join(chunks[0])) == count_words(text)


def test_build_chunks_respects_target_range():
    sentence = "This sentence has exactly eight words in it."  # 8 words
    paragraph = " ".join([sentence] * 10)  # 80 words, one long paragraph
    chunks = build_chunks(paragraph, "short")  # target 30-50 words

    for chunk in chunks[:-1]:
        words = count_words(" ".join(chunk))
        assert words >= 30
