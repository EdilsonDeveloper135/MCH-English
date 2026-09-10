from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url if settings.rate_limit_enabled else "memory://",
    enabled=settings.rate_limit_enabled,
    headers_enabled=True,
)

