from httpx import AsyncClient


async def test_get_and_update_settings(client: AsyncClient, auth_headers: dict[str, str]):
    # 1. Default settings
    res = await client.get("/settings", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["translation_mode"] == "learning"
    assert data["daily_goal_minutes"] == 15
    assert data["timezone"] == "UTC"

    # 2. Update settings
    patch_res = await client.patch(
        "/settings",
        json={"translation_mode": "assisted", "daily_goal_minutes": 30, "timezone": "America/Lima"},
        headers=auth_headers,
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["translation_mode"] == "assisted"
    assert updated_data["daily_goal_minutes"] == 30
    assert updated_data["timezone"] == "America/Lima"

    # 3. Read back
    res2 = await client.get("/settings", headers=auth_headers)
    assert res2.status_code == 200
    assert res2.json()["translation_mode"] == "assisted"
    assert res2.json()["daily_goal_minutes"] == 30
    assert res2.json()["timezone"] == "America/Lima"


async def test_update_settings_validation(client: AsyncClient, auth_headers: dict[str, str]):
    # daily_goal_minutes must be between 1 and 480
    res = await client.patch("/settings", json={"daily_goal_minutes": 0}, headers=auth_headers)
    assert res.status_code == 422

    res_too_large = await client.patch("/settings", json={"daily_goal_minutes": 1000}, headers=auth_headers)
    assert res_too_large.status_code == 422

    # timezone must be a valid IANA timezone
    res_invalid_tz = await client.patch("/settings", json={"timezone": "Mars/Olympus_Mons"}, headers=auth_headers)
    assert res_invalid_tz.status_code == 422

