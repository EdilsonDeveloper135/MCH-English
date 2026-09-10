from httpx import AsyncClient


async def _create_ready_text(client: AsyncClient, headers: dict[str, str], process_text_now):
    res = await client.post(
        "/texts",
        json={
            "title": "Recall Text",
            "raw_content": "Learning English vocabulary is fun and rewarding. Practice every single day.",
            "chunk_mode": "normal",
        },
        headers=headers,
    )
    assert res.status_code == 201
    text_data = res.json()
    await process_text_now(text_data["id"])
    return text_data


async def test_recall_missing_words_session_lifecycle(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    text = await _create_ready_text(client, auth_headers, process_text_now)

    # 1. Create missing_words session
    res = await client.post(
        "/recall/sessions",
        json={"text_id": text["id"], "mode": "missing_words"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    session_data = res.json()
    assert session_data["mode"] == "missing_words"
    assert len(session_data["rounds"]) > 0

    round_0 = session_data["rounds"][0]
    sentence_id = round_0["sentence_id"]
    blanks = round_0["blanks"]

    # 2. Submit attempt
    typed = "vocabulary"
    attempt_res = await client.post(
        "/recall/attempts",
        json={
            "recall_session_id": session_data["session_id"],
            "sentence_id": sentence_id,
            "typed": typed,
            "blanks": blanks,
            "correct_characters": len(typed),
            "incorrect_characters": 0,
            "total_characters": len(typed),
            "duration_seconds": 3.5,
        },
        headers=auth_headers,
    )
    assert attempt_res.status_code == 201
    attempt_data = attempt_res.json()
    assert "accuracy" in attempt_data
    assert "correct_words" in attempt_data

    # 3. Finish session
    finish_res = await client.patch(
        f"/recall/sessions/{session_data['session_id']}/finish",
        headers=auth_headers,
    )
    assert finish_res.status_code == 204


async def test_recall_finish_nonexistent_session_returns_404(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.patch(
        "/recall/sessions/00000000-0000-0000-0000-000000000000/finish",
        headers=auth_headers,
    )
    assert res.status_code == 404



async def test_recall_spanish_to_english_requires_confirmed_translation(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    text = await _create_ready_text(client, auth_headers, process_text_now)

    # Calling spanish_to_english without confirmed translation returns 409
    res = await client.post(
        "/recall/sessions",
        json={"text_id": text["id"], "mode": "spanish_to_english"},
        headers=auth_headers,
    )
    assert res.status_code == 409
