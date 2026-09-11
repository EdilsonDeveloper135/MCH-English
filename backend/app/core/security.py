import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import redis.asyncio as aioredis
import structlog
from jwt.exceptions import PyJWTError

from app.core.config import settings

logger = structlog.get_logger(__name__)

# bcrypt's algorithm only uses the first 72 bytes of the input; longer passwords are
# truncated rather than rejected, matching passlib's previous "bcrypt" scheme behavior.
_MAX_PASSWORD_BYTES = 72

# Only the SHA-256 of a token is stored, never the token itself: the blacklist is
# readable by anyone with Redis access, and a raw JWT there is a usable credential.
_BLACKLIST_PREFIX = "bl:"


def hash_password(password: str) -> str:
    truncated = password.encode("utf-8")[:_MAX_PASSWORD_BYTES]
    return bcrypt.hashpw(truncated, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    truncated = plain_password.encode("utf-8")[:_MAX_PASSWORD_BYTES]
    return bcrypt.checkpw(truncated, hashed_password.encode("utf-8"))


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token if isinstance(token, str) else token.decode("utf-8")


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except PyJWTError:
        return None


def remaining_seconds(token: str) -> int:
    """Seconds left until the token's own `exp`. The blacklist entry only needs to
    outlive the token itself -- keeping it for the full configured lifetime (as this
    used to) wastes memory for tokens that were already nearly expired."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
    except PyJWTError:
        return 0

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        return 0
    return max(0, int(exp - datetime.now(timezone.utc).timestamp()))


_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    # An async client, because this runs inside the request path of every
    # authenticated endpoint -- a blocking client would stall the whole event loop
    # for as long as Redis takes to answer.
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url, socket_timeout=1.0, socket_connect_timeout=1.0
        )
    return _redis_client


def _blacklist_key(token: str) -> str:
    return _BLACKLIST_PREFIX + hashlib.sha256(token.encode("utf-8")).hexdigest()


async def revoke_token(token: str) -> None:
    """Blacklist a still-valid token until its natural expiration. Raises if Redis is
    unreachable so the caller can tell the user the logout did not take effect --
    silently swallowing it would report success while the token stayed usable."""
    ttl = remaining_seconds(token)
    if ttl <= 0:
        return
    await _get_redis().setex(_blacklist_key(token), ttl, "1")


async def is_token_revoked(token: str) -> bool:
    """Fails open (and logs) if Redis is unreachable: locking every user out of a
    working API because the cache blinked is worse than honouring a logged-out token
    for a few seconds. /health already reports Redis being down."""
    try:
        return bool(await _get_redis().exists(_blacklist_key(token)))
    except Exception as exc:  # noqa: BLE001
        logger.error("token_revocation_check_failed", error=str(exc))
        return False
