import time
import uuid

import redis.asyncio as aioredis
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import auth, dictation, dictionary, gamification, recall, sessions, settings, statistics, texts, vocabulary
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.limiter import limiter

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()

# Docker's own healthcheck polls this every few seconds -- logging each hit as a
# full request line would drown out everything else in the log stream.
_UNLOGGED_PATHS = {"/health"}


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Binds a request ID (the client's own X-Request-ID if it sent one, otherwise a
    fresh one) to every structlog call made while handling this request, echoes it
    back in the response header, and emits one structured JSON log line per request."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        if request.url.path not in _UNLOGGED_PATHS:
            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
        return response


app = FastAPI(title="MCH-English API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)

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
        redis_client = aioredis.from_url(app_settings.redis_url, socket_timeout=3.0)
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
