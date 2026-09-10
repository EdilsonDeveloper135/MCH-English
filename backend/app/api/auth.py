from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import bearer_scheme, get_current_user
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, revoke_token, verify_password
from app.models.user import User
from app.repositories import user_repository
from app.schemas.auth import Token, UserLogin, UserOut, UserRegister

router = APIRouter()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def register(request: Request, response: Response, payload: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await user_repository.get_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await user_repository.create(db, email=payload.email, password_hash=hash_password(payload.password))
    return Token(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, payload: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await user_repository.get_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return Token(access_token=create_access_token(str(user.id)))


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    revoke_token(credentials.credentials)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=str(current_user.id), email=current_user.email)

