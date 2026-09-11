import subprocess
import uuid
from pathlib import Path
from typing import Iterable

import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

VOICE = "en-us"
WORDS_PER_MINUTE = 150


class TTSUnavailableError(RuntimeError):
    """Synthesis could not be produced (timeout, missing binary, engine error). Carries
    a message safe to show the user; the technical detail goes to the log."""


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
        raise TTSUnavailableError("La sintesis de voz tardo demasiado.") from exc
    except FileNotFoundError as exc:  # espeak-ng missing from the image/host
        logger.error("tts_binary_missing")
        raise TTSUnavailableError("El sintetizador de voz no esta disponible.") from exc
    except subprocess.CalledProcessError as exc:
        logger.error("tts_failed", text_prefix=text[:30], returncode=exc.returncode)
        raise TTSUnavailableError("No se pudo generar el audio de esta oracion.") from exc


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


def delete_cached_audio(sentence_ids: Iterable[uuid.UUID]) -> None:
    """Removes the WAVs of sentences that are going away. The cache-marker rows cascade
    with the sentence, but nothing used to delete the files, so the volume only ever
    grew -- including with audio of texts the user had deleted months ago."""
    for sentence_id in sentence_ids:
        try:
            _cache_path(sentence_id).unlink()
        except FileNotFoundError:
            continue
        except OSError as exc:  # noqa: PERF203 - one bad file must not stop the rest
            logger.warning("audio_cache_delete_failed", sentence_id=str(sentence_id), error=str(exc))
