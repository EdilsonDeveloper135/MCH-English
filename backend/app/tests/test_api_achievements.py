from httpx import AsyncClient


async def _create_ready_text_with_chunk(client: AsyncClient, auth_headers: dict[str, str], process_text_now) -> dict:
    created = (
        await client.post(
            "/texts",
            json={"title": "Achievement Test Book", "raw_content": "The quick brown fox jumps over the lazy dog."},
            headers=auth_headers,
        )
    ).json()
    await process_text_now(created["id"])
    chunk = (await client.get(f"/texts/{created['id']}/chunks/0", headers=auth_headers)).json()
    return {"text_id": created["id"], "chunk_id": chunk["id"]}


async def test_list_achievements_unauthenticated_is_rejected(client: AsyncClient):
    res = await client.get("/achievements")
    assert res.status_code == 401


async def test_list_achievements_returns_all_12_achievements(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.get("/achievements", headers=auth_headers)
    assert res.status_code == 200
    achievements = res.json()
    assert len(achievements) == 12
    for ach in achievements:
        assert "id" in ach
        assert "name" in ach
        assert "description" in ach
        assert "seen" in ach
        assert ach["unlocked_at"] is None
        assert ach["seen"] is False


async def test_session_unlocks_achievement_and_mark_seen_flow(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    ids = await _create_ready_text_with_chunk(client, auth_headers, process_text_now)
    session = (await client.post("/sessions", json=ids, headers=auth_headers)).json()

    # Finish session
    finish_res = await client.patch(
        f"/sessions/{session['id']}",
        json={
            "correct_characters": 10,
            "incorrect_characters": 0,
            "total_characters": 10,
            "duration_seconds": 5.0,
            "errors": [],
        },
        headers=auth_headers,
    )
    assert finish_res.status_code == 200
    finished_data = finish_res.json()

    # Verify new_achievements is included in session finish response
    unlocked_new = finished_data.get("new_achievements", [])
    first_session_unlocked = any(a["id"] == "first_session" for a in unlocked_new)
    assert first_session_unlocked is True

    # Check /achievements: first_session should now be unlocked with seen=False
    list_res = await client.get("/achievements", headers=auth_headers)
    assert list_res.status_code == 200
    ach_list = list_res.json()
    first_ach = next(a for a in ach_list if a["id"] == "first_session")
    assert first_ach["unlocked_at"] is not None
    assert first_ach["seen"] is False

    # Mark seen
    mark_res = await client.post("/achievements/mark-seen", headers=auth_headers)
    assert mark_res.status_code == 200
    assert mark_res.json()["status"] == "ok"
    assert mark_res.json()["marked_count"] >= 1

    # Verify seen is now True
    list_res_after = await client.get("/achievements", headers=auth_headers)
    ach_list_after = list_res_after.json()
    first_ach_after = next(a for a in ach_list_after if a["id"] == "first_session")
    assert first_ach_after["seen"] is True
