import subprocess
import uuid
from pathlib import Path

import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

VOICE = "en-us"
WORDS_PER_MINUTE = 150


def synthesize(text: str) -> bytes:
    """Generates WAV audio for `text` using eSpeak-NG -- classic formant synthesis,
    no neural network/AI involved, no network access. Kept behind this single
    function so a different TTSProvider could replace it later without touching
    any caller (see spec section 28)."""
    try:
        result = subprocess.run(
            ["espeak-ng", "-v", VOICE, "-s", str(WORDS_PER_MINUTE), "--stdout", "--", text],
            capture_output=True,
            check=True,
            timeout=15.0,
        )
        return result.stdout
    except subprocess.TimeoutExpired as exc:
        logger.error("tts_timeout", text_prefix=text[:30], timeout=15.0)
        raise RuntimeError(f"eSpeak-NG timed out synthesizing text: {text[:30]!r}") from exc


def _cache_path(sentence_id: uuid.UUID) -> Path:

    return Path(settings.audio_cache_dir) / f"{sentence_id}.wav"


def read_cached_audio(sentence_id: uuid.UUID) -> bytes | None:
    """Returns the cached WAV bytes for a sentence, or None if no file is cached
    (including the case where a DictationAudio row exists but the file itself is
    missing, e.g. the volume was wiped independently of the DB -- caller should
    treat that the same as a cold cache miss and resynthesize)."""
    path = _cache_path(sentence_id)
    if not path.is_file():
        return None
    return path.read_bytes()


def write_cached_audio(sentence_id: uuid.UUID, audio_bytes: bytes) -> None:
    path = _cache_path(sentence_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(audio_bytes)
