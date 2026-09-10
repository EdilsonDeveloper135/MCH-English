from httpx import AsyncClient

from app.core.database import async_session_maker
from app.models.dictionary import DictionaryEntry


async def test_dictionary_lookup_missing_word_returns_404(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.get("/dictionary/nonexistentword12345", headers=auth_headers)
    assert res.status_code == 404


async def test_dictionary_lookup_existing_word_returns_translations(client: AsyncClient, auth_headers: dict[str, str]):
    async with async_session_maker() as db:
        entry = DictionaryEntry(headword="kitten", translations="gatito")
        db.add(entry)
        await db.commit()

    res = await client.get("/dictionary/kitten", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["word"] == "kitten"
    assert "gatito" in data["translations"]

