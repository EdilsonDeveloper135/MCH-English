from app.schemas.sessions import SessionStatsSummaryOut, WpmTrendPoint, ErrorCharStat, DailyStatSummary, SessionHistoryItem


def test_session_stats_summary_schema_serialization():
    payload = {
        "wpm_trend": [{"date": "10/09 12:00", "wpm": 60.5, "accuracy": 95.0}],
        "error_chars": [{"char": "e", "count": 10}, {"char": " ", "count": 5}],
        "daily_summary": [{"date": "2026-09-10", "sessions": 3, "avg_wpm": 58.2, "avg_accuracy": 94.1}],
        "recent_sessions": [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "date": "2026-09-10 12:00",
                "text_title": "Test Title",
                "wpm": 60.5,
                "accuracy": 95.0,
                "errors": 2,
                "duration_seconds": 40.0,
                "xp_earned": 200,
            }
        ],
    }

    out = SessionStatsSummaryOut(**payload)
    assert len(out.wpm_trend) == 1
    assert out.wpm_trend[0].wpm == 60.5
    assert len(out.error_chars) == 2
    assert out.error_chars[0].char == "e"
    assert out.daily_summary[0].sessions == 3
    assert out.recent_sessions[0].text_title == "Test Title"

    # Verify Pydantic v2 ultra-fast json dump & validate roundtrip
    dumped = out.model_dump_json()
    assert isinstance(dumped, str)
    restored = SessionStatsSummaryOut.model_validate_json(dumped)
    assert restored.recent_sessions[0].id == out.recent_sessions[0].id


def test_stats_cache_key_generation():
    import uuid
    from app.schemas.sessions import stats_cache_key

    user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    assert stats_cache_key(user_id, 30) == "cache:stats:11111111-1111-1111-1111-111111111111:30"

