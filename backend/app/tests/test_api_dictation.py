from httpx import AsyncClient


async def _create_ready_text(client: AsyncClient, headers: dict[str, str], process_text_now):
    res = await client.post(
        "/texts",
        json={
            "title": "Dictation Book",
            "raw_content": "The quick brown fox jumps over the lazy dog. Dogs are loyal friends.",
            "chunk_mode": "normal",
        },
        headers=headers,
    )
    assert res.status_code == 201
    text_data = res.json()
    await process_text_now(text_data["id"])
    return text_data


async def test_dictation_session_lifecycle(client: AsyncClient, auth_headers: dict[str, str], process_text_now):
    text = await _create_ready_text(client, auth_headers, process_text_now)

    # 1. Create dictation session
    res = await client.post("/dictation/sessions", json={"text_id": text["id"]}, headers=auth_headers)
    assert res.status_code == 201
    session_data = res.json()
    assert "session_id" in session_data
    assert len(session_data["rounds"]) >= 1
    round_0 = session_data["rounds"][0]
    sentence_id = round_0["sentence_id"]

    # 2. Get synthesized audio for sentence
    audio_res = await client.get(f"/dictation/audio/{sentence_id}", headers=auth_headers)
    assert audio_res.status_code == 200
    assert audio_res.headers["content-type"] == "audio/wav"
    assert len(audio_res.content) > 0

    # 3. Submit dictation attempt
    attempt_res = await client.post(
        "/dictation/attempts",
        json={
            "dictation_session_id": session_data["session_id"],
            "sentence_id": sentence_id,
            "typed": round_0["content"],
            "correct_characters": len(round_0["content"]),
            "incorrect_characters": 0,
            "total_characters": len(round_0["content"]),
            "duration_seconds": 5.0,
        },
        headers=auth_headers,
    )

    assert attempt_res.status_code == 201
    attempt_data = attempt_res.json()
    assert attempt_data["accuracy"] == 100.0
    assert attempt_data["correct_words"] > 0
    assert attempt_data["incorrect_words"] == 0

    # 4. Finish session
    finish_res = await client.patch(f"/dictation/sessions/{session_data['session_id']}/finish", headers=auth_headers)
    assert finish_res.status_code == 204


async def test_dictation_session_rejects_missing_text(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.post(
        "/dictation/sessions",
        json={"text_id": "00000000-0000-0000-0000-000000000000"},
        headers=auth_headers,
    )
    assert res.status_code == 404


async def test_dictation_attempt_rejects_unowned_sentence(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    text = await _create_ready_text(client, auth_headers, process_text_now)
    res = await client.post("/dictation/sessions", json={"text_id": text["id"]}, headers=auth_headers)
    session_data = res.json()

    attempt_res = await client.post(
        "/dictation/attempts",
        json={
            "dictation_session_id": session_data["session_id"],
            "sentence_id": "00000000-0000-0000-0000-000000000000",
            "typed": "hello",
            "correct_characters": 5,
            "incorrect_characters": 0,
            "total_characters": 5,
            "duration_seconds": 1.0,
        },
        headers=auth_headers,
    )
    assert attempt_res.status_code == 404


async def test_dictation_finish_nonexistent_session_returns_404(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.patch("/dictation/sessions/00000000-0000-0000-0000-000000000000/finish", headers=auth_headers)
    assert res.status_code == 404

