from app.services import tts_service


def test_synthesize_handles_leading_dashes_safely():
    # Sentences starting with dashes must not be interpreted as CLI options
    text = '-- "What do you mean?", asked Alice.'
    audio_bytes = tts_service.synthesize(text)
    assert isinstance(audio_bytes, bytes)
    assert len(audio_bytes) > 0
    # WAV header magic "RIFF"
    assert audio_bytes[:4] == b"RIFF"
