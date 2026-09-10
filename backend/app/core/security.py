from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from jwt.exceptions import PyJWTError

from app.core.config import settings

# bcrypt's algorithm only uses the first 72 bytes of the input; longer passwords are
# truncated rather than rejected, matching passlib's previous "bcrypt" scheme behavior.
_MAX_PASSWORD_BYTES = 72
_revoked_tokens: set[str] = set()


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


_redis_sync_client = None


def _get_redis():
    global _redis_sync_client
    if _redis_sync_client is None:
        try:
            import redis

            _redis_sync_client = redis.from_url(settings.redis_url, socket_timeout=1.0)
        except Exception:
            _redis_sync_client = False
    return _redis_sync_client if _redis_sync_client is not False else None


def revoke_token(token: str) -> None:
    """Blacklist a token until its natural expiration."""
    _revoked_tokens.add(token)
    try:
        r = _get_redis()
        if r is not None:
            r.setex(f"bl_{token}", settings.jwt_access_token_expire_minutes * 60, "1")
    except Exception:
        pass


def is_token_revoked(token: str) -> bool:
    """Check if token was revoked via logout."""
    if token in _revoked_tokens:
        return True
    try:
        r = _get_redis()
        if r is not None:
            return bool(r.exists(f"bl_{token}"))
    except Exception:
        pass
    return False

