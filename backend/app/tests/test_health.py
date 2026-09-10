from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.core.database import get_db
from app.main import app


async def test_health_endpoint_reports_ok_when_database_and_redis_are_reachable(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": True, "redis": True}}


async def test_health_endpoint_returns_503_when_the_database_is_unreachable(client: AsyncClient):
    async def broken_get_db():
        session = AsyncMock()
        session.execute.side_effect = ConnectionRefusedError("db down")
        yield session

    app.dependency_overrides[get_db] = broken_get_db
    try:
        response = await client.get("/health")
        assert response.status_code == 503
        assert response.json()["checks"]["database"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_health_endpoint_returns_503_when_redis_is_unreachable(client: AsyncClient, monkeypatch):
    # Nothing listens on this port -- the connection is refused immediately instead
    # of hanging, which is exactly what a *down* Redis looks like from the app's side.
    monkeypatch.setattr("app.main.app_settings.redis_url", "redis://localhost:1/0")

    response = await client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["checks"]["redis"] is False
    assert body["checks"]["database"] is True
