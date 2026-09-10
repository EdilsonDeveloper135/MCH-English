from httpx import AsyncClient


async def test_register_creates_a_user_and_returns_a_usable_token(client: AsyncClient):
    response = await client.post("/auth/register", json={"email": "new@example.com", "password": "testpass123"})
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"


async def test_register_rejects_a_duplicate_email(client: AsyncClient):
    payload = {"email": "dup@example.com", "password": "testpass123"}
    first = await client.post("/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/auth/register", json=payload)
    assert second.status_code == 409


async def test_register_rejects_a_password_under_8_characters(client: AsyncClient):
    response = await client.post("/auth/register", json={"email": "short@example.com", "password": "short"})
    assert response.status_code == 422


async def test_login_with_correct_credentials_returns_a_token(client: AsyncClient):
    await client.post("/auth/register", json={"email": "login@example.com", "password": "testpass123"})

    response = await client.post("/auth/login", json={"email": "login@example.com", "password": "testpass123"})
    assert response.status_code == 200
    assert response.json()["access_token"]


async def test_login_with_wrong_password_is_rejected(client: AsyncClient):
    await client.post("/auth/register", json={"email": "wrongpass@example.com", "password": "testpass123"})

    response = await client.post("/auth/login", json={"email": "wrongpass@example.com", "password": "nope12345"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


async def test_login_with_unknown_email_is_rejected(client: AsyncClient):
    response = await client.post("/auth/login", json={"email": "ghost@example.com", "password": "testpass123"})
    assert response.status_code == 401


async def test_protected_endpoint_requires_a_token(client: AsyncClient):
    response = await client.get("/texts")
    assert response.status_code in (401, 403)


async def test_protected_endpoint_rejects_a_malformed_token(client: AsyncClient):
    response = await client.get("/texts", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert response.status_code == 401
