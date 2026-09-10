from httpx import AsyncClient
import uuid

from app.core.database import async_session_maker
from app.models.vocabulary import VocabularyItem


async def test_list_vocabulary_and_weak_words(client: AsyncClient, auth_headers: dict[str, str]):
    # Initially empty
    res = await client.get("/vocabulary", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []

    weak_res = await client.get("/vocabulary/weak", headers=auth_headers)
    assert weak_res.status_code == 200
    assert weak_res.json() == []


async def test_weak_words_session_returns_404_when_no_weak_words(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.post("/vocabulary/weak/session", headers=auth_headers)
    assert res.status_code == 404


async def test_list_vocabulary_with_existing_records(client: AsyncClient, auth_headers: dict[str, str]):
    me = await client.get("/auth/me", headers=auth_headers)
    user_id = uuid.UUID(me.json()["id"])

    async with async_session_maker() as db:
        item = VocabularyItem(
            user_id=user_id,
            word="persistent",
            encounters=10,
            typing_errors=4,
            mastery_score=50.0,
        )
        db.add(item)
        await db.commit()

    res = await client.get("/vocabulary", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["word"] == "persistent"

    weak = await client.get("/vocabulary/weak", headers=auth_headers)
    assert weak.status_code == 200
    assert len(weak.json()) == 1
    assert weak.json()[0]["word"] == "persistent"

