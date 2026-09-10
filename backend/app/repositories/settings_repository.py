import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSettings


async def get_or_create(db: AsyncSession, user_id: uuid.UUID) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        await db.commit()
    return settings


async def update(db: AsyncSession, settings: UserSettings, **fields) -> UserSettings:
    for key, value in fields.items():
        if value is not None:
            setattr(settings, key, value)
    await db.commit()
    return settings
