from httpx import AsyncClient

RAW_TEXT = "Hi cats run. Dogs jump now."


async def _create_text(client: AsyncClient, headers: dict[str, str], **overrides) -> dict:
    payload = {"title": "My text", "raw_content": RAW_TEXT, "chunk_mode": "continuous"}
    payload.update(overrides)
    response = await client.post("/texts", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


async def test_create_text_starts_pending_and_uploader_can_see_it_in_their_library(
    client: AsyncClient, auth_headers: dict[str, str]
):
    text = await _create_text(client, auth_headers)
    assert text["status"] == "pending"
    assert text["word_count"] == 6

    listing = await client.get("/texts", headers=auth_headers)
    assert listing.status_code == 200
    assert [t["id"] for t in listing.json()] == [text["id"]]


async def test_create_text_rejects_blank_content(client: AsyncClient, auth_headers: dict[str, str]):
    response = await client.post(
        "/texts", json={"title": "Blank", "raw_content": "   ", "chunk_mode": "normal"}, headers=auth_headers
    )
    assert response.status_code == 422


async def test_smart_chunking_produces_sentences_and_marks_the_text_ready(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    text = await _create_text(client, auth_headers)

    await process_text_now(text["id"])

    updated = await client.get(f"/texts/{text['id']}", headers=auth_headers)
    assert updated.status_code == 200
    assert updated.json()["status"] == "ready"
    assert updated.json()["chunk_count"] == 1

    chunk = await client.get(f"/texts/{text['id']}/chunks/0", headers=auth_headers)
    assert chunk.status_code == 200
    sentences = chunk.json()["sentences"]
    assert [s["content"] for s in sentences] == ["Hi cats run.", "Dogs jump now."]
    # No AI/dictionary involvement here -- difficult_words is purely a cross-reference
    # against this user's own weak vocabulary, and they have none yet.
    assert sentences[0]["difficult_words"] == []


async def test_a_user_cannot_read_another_users_text(client: AsyncClient, auth_headers: dict[str, str]):
    text = await _create_text(client, auth_headers)

    other_register = await client.post(
        "/auth/register", json={"email": "other-owner@example.com", "password": "testpass123"}
    )
    other_headers = {"Authorization": f"Bearer {other_register.json()['access_token']}"}

    response = await client.get(f"/texts/{text['id']}", headers=other_headers)
    assert response.status_code == 404


async def test_delete_text_removes_it_from_the_owners_library(client: AsyncClient, auth_headers: dict[str, str]):
    text = await _create_text(client, auth_headers)

    delete_response = await client.delete(f"/texts/{text['id']}", headers=auth_headers)
    assert delete_response.status_code == 204

    listing = await client.get("/texts", headers=auth_headers)
    assert listing.json() == []


async def test_add_and_delete_a_grammar_phrase_on_a_sentence(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    text = await _create_text(client, auth_headers)
    await process_text_now(text["id"])
    chunk = (await client.get(f"/texts/{text['id']}/chunks/0", headers=auth_headers)).json()
    sentence_id = chunk["sentences"][0]["id"]

    add_response = await client.post(
        f"/texts/{text['id']}/sentences/{sentence_id}/phrases",
        json={"english_phrase": "cats run", "spanish_phrase": "los gatos corren"},
        headers=auth_headers,
    )
    assert add_response.status_code == 201
    phrase_id = add_response.json()["id"]

    chunk_after_add = (await client.get(f"/texts/{text['id']}/chunks/0", headers=auth_headers)).json()
    assert len(chunk_after_add["sentences"][0]["phrases"]) == 1

    delete_response = await client.delete(
        f"/texts/{text['id']}/sentences/{sentence_id}/phrases/{phrase_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    chunk_after_delete = (await client.get(f"/texts/{text['id']}/chunks/0", headers=auth_headers)).json()
    assert chunk_after_delete["sentences"][0]["phrases"] == []


async def test_update_translation_and_alignment_endpoints(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    text = await _create_text(client, auth_headers)
    await process_text_now(text["id"])

    # Update translation
    update_res = await client.patch(
        f"/texts/{text['id']}/translation",
        json={"translation_content": "Aprender un idioma requiere práctica constante."},
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["alignment_status"] == "needs_review"

    # Get alignment
    align_res = await client.get(f"/texts/{text['id']}/alignment", headers=auth_headers)
    assert align_res.status_code == 200
    align_data = align_res.json()
    assert "links" in align_data
    assert "alignment_status" in align_data

    # Update alignment
    confirm_res = await client.put(
        f"/texts/{text['id']}/alignment",
        json={"links": align_data["links"]},
        headers=auth_headers,
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["alignment_status"] == "confirmed"




async def test_progress_is_clamped_to_the_real_chunk_count(
    client: AsyncClient, auth_headers: dict[str, str], process_text_now
):
    """An out-of-range index produced a progress above 100% and made the
    "text completed" achievement unlockable without practicing anything."""
    text = await _create_text(client, auth_headers)
    await process_text_now(text["id"])

    response = await client.patch(
        f"/texts/{text['id']}/progress",
        json={"current_chunk_index": 9999, "current_character_index": 0},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["current_chunk_index"] == body["chunk_count"] == 1
    assert body["progress_percent"] == 100.0
