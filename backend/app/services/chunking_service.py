import re

# (min_words, max_words) target range per chunk mode. "continuous" has no range: the
# whole text becomes a single chunk.
CHUNK_RANGES: dict[str, tuple[int, int]] = {
    "short": (30, 50),
    "normal": (60, 80),
    "long": (100, 150),
}

# Common abbreviations that end in a period but do NOT end a sentence. Used to avoid
# false-positive sentence breaks like "Mr. Smith" -> ["Mr.", "Smith ..."]. Covers both
# English and Spanish since this splitter is reused for the user-supplied translation
# (section title "sr."/"sra."/"dra." etc. are the Spanish equivalents).
_ABBREVIATIONS = {
    "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "vs.", "etc.",
    "e.g.", "i.e.", "u.s.", "u.k.", "st.", "mt.", "no.", "inc.", "ltd.", "co.",
    "sra.", "srta.", "dra.", "ud.", "uds.", "pág.", "págs.",
}

# Splits right after sentence-ending punctuation, only when followed by whitespace and
# then a capital letter, digit or quote (a reasonable heuristic for "new sentence starts here").
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")
_WORD_RE = re.compile(r"[A-Za-z0-9']+")


def clean_text(raw: str) -> str:
    """Normalizes line endings/whitespace while preserving paragraph breaks."""
    normalized = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in normalized.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def split_sentences(paragraph: str) -> list[str]:
    flat = " ".join(paragraph.split())
    if not flat:
        return []

    candidates = _SENTENCE_SPLIT_RE.split(flat)

    sentences: list[str] = []
    buffer = ""
    for candidate in candidates:
        buffer = f"{buffer} {candidate}".strip() if buffer else candidate
        last_word = buffer.split(" ")[-1].lower() if buffer else ""
        if last_word in _ABBREVIATIONS:
            continue
        sentences.append(buffer)
        buffer = ""
    if buffer:
        sentences.append(buffer)
    return [s for s in sentences if s]


def count_words(text: str) -> int:
    return len(_WORD_RE.findall(text))


def extract_words(text: str) -> list[str]:
    return _WORD_RE.findall(text)


def find_words_with_spans(text: str) -> list[tuple[int, int, str]]:
    """Same word matches as extract_words, but with their (start, end) character
    offsets in `text` -- needed to know where to place Recall's Missing Words blanks."""
    return [(m.start(), m.end(), m.group()) for m in _WORD_RE.finditer(text)]


def split_into_sentences(text: str) -> list[str]:
    """Flat, paragraph-aware sentence list. Paragraph breaks only act as sentence
    boundaries here -- unlike build_chunks, no chunk grouping is applied. Used for the
    user-supplied translation, which doesn't need Smart Chunking of its own."""
    cleaned = clean_text(text)
    return [s for paragraph in split_paragraphs(cleaned) for s in split_sentences(paragraph)]


def build_chunks(raw_content: str, chunk_mode: str) -> list[list[str]]:
    """Splits raw text into chunks of sentences for Smart Chunking (never mid-sentence).

    Priority: 1) close at paragraph end once the target minimum is reached,
    2) otherwise close at the sentence end where the target maximum is reached,
    3) never split a sentence itself.
    """
    cleaned = clean_text(raw_content)
    paragraphs = split_paragraphs(cleaned)
    paragraph_sentences = [split_sentences(p) for p in paragraphs]

    if chunk_mode == "continuous":
        flat_sentences = [s for sentences in paragraph_sentences for s in sentences]
        return [flat_sentences] if flat_sentences else [[]]

    min_words, max_words = CHUNK_RANGES.get(chunk_mode, CHUNK_RANGES["normal"])

    chunks: list[list[str]] = []
    current: list[str] = []
    current_words = 0

    for sentences in paragraph_sentences:
        for s_index, sentence in enumerate(sentences):
            current.append(sentence)
            current_words += count_words(sentence)

            is_last_in_paragraph = s_index == len(sentences) - 1
            reached_max = current_words >= max_words
            reached_min_at_paragraph_end = is_last_in_paragraph and current_words >= min_words

            if reached_max or reached_min_at_paragraph_end:
                chunks.append(current)
                current = []
                current_words = 0

    if current:
        # Leftover shorter than half the minimum: fold into the previous chunk instead
        # of leaving a tiny trailing chunk. Otherwise it stands on its own.
        if chunks and count_words(" ".join(current)) < min_words / 2:
            chunks[-1].extend(current)
        else:
            chunks.append(current)

    return chunks or [[]]
