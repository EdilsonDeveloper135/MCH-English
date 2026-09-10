import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import create_async_engine

# Point the app at a dedicated test database on the same Postgres server *before*
# app.core.config / app.core.database build their engine and session objects --
# both do that once, at import time, from this env var. Postgres-specific features
# used throughout the app (pg_insert/on_conflict, the `~*` regex operator) rule out
# an in-memory SQLite substitute, so this uses a real, throwaway Postgres database
# instead, never the dev database itself.
_BASE_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@postgres:5432/mch_english")
_TEST_DATABASE_URL = _BASE_DATABASE_URL.rsplit("/", 1)[0] + "/mch_english_test"
os.environ["DATABASE_URL"] = _TEST_DATABASE_URL


def _admin_database_url() -> str:
    # CREATE/DROP DATABASE can't run on a connection to the database being
    # created/dropped -- connect to the default maintenance database instead.
    return _BASE_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"


import app.models  # noqa: E402  (registers every model on Base.metadata before create_all)
import app.core.database  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402
from app.core.config import settings as app_settings  # noqa: E402
from app.core.database import Base  # noqa: E402

# Replace engine in test process with NullPool to prevent loop attachment errors across tests
test_engine = create_async_engine(_TEST_DATABASE_URL, echo=False, poolclass=NullPool)
app.core.database.engine = test_engine
app.core.database.async_session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
engine = test_engine

from app.main import app as fastapi_app, limiter  # noqa: E402

# Disable rate limiter during general tests to prevent 429 on repetitive test requests
app_settings.rate_limit_enabled = False
limiter.enabled = False



@pytest_asyncio.fixture(scope="session", autouse=True)
async def _setup_test_database():
    admin_engine = create_async_engine(_admin_database_url(), isolation_level="AUTOCOMMIT")
    try:
        async with admin_engine.connect() as conn:
            await conn.execute(sql_text("DROP DATABASE IF EXISTS mch_english_test"))
            await conn.execute(sql_text("CREATE DATABASE mch_english_test"))
    finally:
        await admin_engine.dispose()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()




@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest.fixture(autouse=True)
def _no_real_queue(monkeypatch):
    # No test has a live RQ worker attached to the test database -- silence the
    # enqueue call so it never touches the real Redis queue. Tests that need
    # chunking to actually happen call the `process_text_now` fixture below
    # explicitly instead, so it runs deterministically inside the test's own event
    # loop rather than racing an out-of-process worker.
    monkeypatch.setattr("app.services.text_service.enqueue_process_text", lambda text_id: None)


@pytest_asyncio.fixture
async def process_text_now():
    from app.workers.jobs import _process_text_async

    return _process_text_async


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Registers a fresh user through the real endpoint and returns its auth header."""
    email = f"user-{uuid.uuid4().hex[:12]}@example.com"
    response = await client.post("/auth/register", json={"email": email, "password": "testpass123"})
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
