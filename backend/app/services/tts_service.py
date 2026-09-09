import subprocess

VOICE = "en-us"
WORDS_PER_MINUTE = 150


def synthesize(text: str) -> bytes:
    """Generates WAV audio for `text` using eSpeak-NG -- classic formant synthesis,
    no neural network/AI involved, no network access. Kept behind this single
    function so a different TTSProvider could replace it later without touching
    any caller (see spec section 28)."""
    result = subprocess.run(
        ["espeak-ng", "-v", VOICE, "-s", str(WORDS_PER_MINUTE), "--stdout", text],
        capture_output=True,
        check=True,
    )
    return result.stdout
