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


async def test_logout_revokes_token_and_rejects_subsequent_requests(client: AsyncClient):
    # Register user
    reg = await client.post("/auth/register", json={"email": "logout_user@example.com", "password": "testpass123"})
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify access works before logout
    me = await client.get("/auth/me", headers=headers)
    assert me.status_code == 200

    # Logout
    logout_res = await client.post("/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    # Verify access is now rejected with 401
    me_after = await client.get("/auth/me", headers=headers)
    assert me_after.status_code == 401
    assert "revoked" in me_after.json()["detail"].lower() or "expired" in me_after.json()["detail"].lower() or "invalid" in me_after.json()["detail"].lower()


async def test_login_rate_limiting_returns_429_after_limit_exceeded(client: AsyncClient):
    from app.core.limiter import limiter
    limiter.enabled = True
    try:
        # 5 attempts are allowed per minute on /auth/login
        for _ in range(5):
            await client.post("/auth/login", json={"email": "nonexistent@example.com", "password": "wrong"})
        
        # 6th attempt must return 429 Too Many Requests
        sixth = await client.post("/auth/login", json={"email": "nonexistent@example.com", "password": "wrong"})
        assert sixth.status_code == 429
        assert "retry-after" in sixth.headers
    finally:
        limiter.enabled = False



async def test_logout_requires_a_valid_token(client: AsyncClient):
    """The endpoint used to blacklist whatever string it was given, without checking
    it, letting an unauthenticated caller write arbitrary keys into Redis."""
    response = await client.post("/auth/logout", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert response.status_code == 401

    without_header = await client.post("/auth/logout")
    assert without_header.status_code == 401


async def test_email_is_case_insensitive_across_register_and_login(client: AsyncClient):
    register = await client.post("/auth/register", json={"email": "Mixed.Case@Example.com", "password": "testpass123"})
    assert register.status_code == 201

    duplicate = await client.post("/auth/register", json={"email": "mixed.case@example.com", "password": "testpass123"})
    assert duplicate.status_code == 409

    login = await client.post("/auth/login", json={"email": "MIXED.CASE@example.com", "password": "testpass123"})
    assert login.status_code == 200
