import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token, is_token_revoked
from app.models.user import User
from app.repositories import user_repository

# auto_error=False so a missing header produces our own 401 (with the same body as an
# invalid token) instead of FastAPI's default 403, which the frontend does not treat
# as "your session ended".
bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None:
        raise _UNAUTHORIZED
    return credentials.credentials


async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(token)
    if user_id is None:
        raise _UNAUTHORIZED

    if await is_token_revoked(token):
        raise _UNAUTHORIZED

    try:
        user = await user_repository.get_by_id(db, uuid.UUID(user_id))
    except ValueError:
        user = None

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user
