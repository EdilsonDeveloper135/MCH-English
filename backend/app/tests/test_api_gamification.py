from httpx import AsyncClient


async def test_get_gamification_overview(client: AsyncClient, auth_headers: dict[str, str]):
    res = await client.get("/gamification/overview", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "level" in data
    assert "total_xp" in data
    assert "current_streak" in data
    assert "longest_streak" in data
    assert len(data["achievements"]) > 0


async def test_gamification_overview_respects_user_timezone(client: AsyncClient, auth_headers: dict[str, str]):
    # Set timezone to Asia/Tokyo (UTC+9)
    patch_res = await client.patch("/settings", json={"timezone": "Asia/Tokyo"}, headers=auth_headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["timezone"] == "Asia/Tokyo"

    res = await client.get("/gamification/overview", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "practice_seconds_today" in data
    assert "daily_goal_minutes" in data
    assert "current_streak" in data

