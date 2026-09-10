from httpx import AsyncClient


async def test_get_gamification_overview(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.get("/gamification/overview", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "level" in data
    assert "total_xp" in data
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "achievements" in data
    assert len(data["achievements"]) > 0
