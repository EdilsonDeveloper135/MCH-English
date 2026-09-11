from httpx import AsyncClient

RAW_TEXT = "Hi cats run. Dogs jump now."


async def _create_ready_text_with_chunk(client: AsyncClient, headers: dict[str, str], process_text_now) -> dict:
    create_response = await client.post(
        "/texts",
        json={"title": "Session test", "raw_content": RAW_TEXT, "chunk_mode": "continuous"},
        headers=headers,
    )
    text = create_response.json()
    await process_text_now(text["id"])
    chunk = (await client.get(f"/texts/{text['id']}/chunks/0", headers=headers)).json()
    return {"text_id": text["id"], "chunk_id": chunk["id"]}


async def test_create_session_for_a_ready_chunk(client: AsyncClient, auth_headers: dict[str, str], process_text_now):
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)

    response = await client.post("/sessions", json=ids, headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["text_id"] == ids["text_id"]
    assert body["chunk_id"] == ids["chunk_id"]
    assert body["finished_at"] is None


async def test_create_session_rejects_a_chunk_that_does_not_belong_to_the_text(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    other_ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)

    response = await client.post(
        "/sessions", json={"text_id": ids["text_id"], "chunk_id": other_ids["chunk_id"]}, headers=auth_headers
    )
    assert response.status_code == 404


async def test_finish_session_persists_wpm_and_accuracy(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    session = (await client.post("/sessions", json=ids, headers=auth_headers)).json()

    response = await client.patch(
        f"/sessions/{session['id']}",
        json={
            "correct_characters": 25,
            "incorrect_characters": 0,
            "total_characters": 25,
            "duration_seconds": 15,
            "errors": [],
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["wpm"] == 20.0
    assert body["accuracy"] == 100.0
    assert body["finished_at"] is not None


async def test_finish_session_unlocks_the_first_session_achievement(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    session = (await client.post("/sessions", json=ids, headers=auth_headers)).json()

    overview_before = (await client.get("/gamification/overview", headers=auth_headers)).json()
    first_session_before = next(a for a in overview_before["achievements"] if a["id"] == "first_session")
    assert first_session_before["unlocked"] is False

    await client.patch(
        f"/sessions/{session['id']}",
        json={"correct_characters": 10, "incorrect_characters": 0, "total_characters": 10, "duration_seconds": 5, "errors": []},
        headers=auth_headers,
    )

    overview_after = (await client.get("/gamification/overview", headers=auth_headers)).json()
    first_session_after = next(a for a in overview_after["achievements"] if a["id"] == "first_session")
    assert first_session_after["unlocked"] is True
    assert overview_after["total_xp"] >= 10  # 1 XP per correct character


async def test_a_user_cannot_finish_another_users_session(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    session = (await client.post("/sessions", json=ids, headers=auth_headers)).json()

    other_register = await client.post(
        "/auth/register", json={"email": "other-session@example.com", "password": "testpass123"}
    )
    other_headers = {"Authorization": f"Bearer {other_register.json()['access_token']}"}

    response = await client.patch(
        f"/sessions/{session['id']}",
        json={"correct_characters": 1, "incorrect_characters": 0, "total_characters": 1, "duration_seconds": 1, "errors": []},
        headers=other_headers,
    )
    assert response.status_code == 404


async def test_finishing_a_session_twice_is_rejected(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    """A replayed PATCH used to insert the error rows again and count every word of the
    chunk as another encounter, quietly inflating the vocabulary mastery scores."""
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    session = (await client.post("/sessions", json=ids, headers=auth_headers)).json()
    payload = {
        "correct_characters": 20,
        "incorrect_characters": 1,
        "total_characters": 21,
        "duration_seconds": 10,
        "errors": [{"expected_char": "a", "typed_char": "s", "position": 1, "word": "cats"}],
    }

    first = await client.patch(f"/sessions/{session['id']}", json=payload, headers=auth_headers)
    assert first.status_code == 200

    second = await client.patch(f"/sessions/{session['id']}", json=payload, headers=auth_headers)
    assert second.status_code == 409

    vocabulary = (await client.get("/vocabulary", headers=auth_headers)).json()
    cats = next(item for item in vocabulary if item["word"] == "cats")
    assert cats["encounters"] == 1
    assert cats["typing_errors"] == 1


async def test_finish_session_clips_oversized_error_fields_instead_of_failing(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    """`typing_errors.word` is VARCHAR(255) and the char columns are VARCHAR(8): an
    over-long token in the source text used to make the whole save fail with a 500."""
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    session = (await client.post("/sessions", json=ids, headers=auth_headers)).json()

    response = await client.patch(
        f"/sessions/{session['id']}",
        json={
            "correct_characters": 1,
            "incorrect_characters": 1,
            "total_characters": 2,
            "duration_seconds": 5,
            "errors": [
                {"expected_char": "x" * 40, "typed_char": "y" * 40, "position": 0, "word": "w" * 900}
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 200


async def test_history_rejects_an_out_of_range_day_window(client: AsyncClient, auth_headers: dict[str, str]):
    """An unbounded `days` went straight into timedelta(days=...) and raised OverflowError."""
    response = await client.get("/statistics/history?days=1000000000", headers=auth_headers)
    assert response.status_code == 422

    ok = await client.get("/statistics/history?days=30", headers=auth_headers)
    assert ok.status_code == 200
