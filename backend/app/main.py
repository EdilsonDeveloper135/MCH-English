import redis.asyncio as aioredis
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import auth, dictation, dictionary, gamification, recall, sessions, settings, statistics, texts, vocabulary
from app.core.config import settings as app_settings
from app.core.database import get_db

app = FastAPI(title="MCH-English API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(texts.router, prefix="/texts", tags=["texts"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(statistics.router, prefix="/statistics", tags=["statistics"])
app.include_router(dictionary.router, prefix="/dictionary", tags=["dictionary"])
app.include_router(vocabulary.router, prefix="/vocabulary", tags=["vocabulary"])
app.include_router(recall.router, prefix="/recall", tags=["recall"])
app.include_router(dictation.router, prefix="/dictation", tags=["dictation"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(gamification.router, prefix="/gamification", tags=["gamification"])


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    checks = {"database": False, "redis": False}

    try:
        await db.execute(sql_text("SELECT 1"))
        checks["database"] = True
    except Exception:  # noqa: BLE001 - a health check must never itself crash
        pass

    try:
        redis_client = aioredis.from_url(app_settings.redis_url)
        try:
            await redis_client.ping()
            checks["redis"] = True
        finally:
            await redis_client.aclose()
    except Exception:  # noqa: BLE001
        pass

    if not all(checks.values()):
        return JSONResponse(status_code=503, content={"status": "unavailable", "checks": checks})
    return {"status": "ok", "checks": checks}
