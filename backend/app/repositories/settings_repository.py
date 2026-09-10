import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSettings


async def get_or_create(db: AsyncSession, user_id: uuid.UUID) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if settings is not None:
        return settings

    # Race-safe: if two concurrent requests both find nothing and both reach here,
    # the second INSERT becomes a no-op instead of raising IntegrityError on the
    # unique user_id constraint, and both then read back the one row that exists.
    stmt = pg_insert(UserSettings).values(user_id=user_id).on_conflict_do_nothing(index_elements=[UserSettings.user_id])
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    return result.scalar_one()


async def update(db: AsyncSession, settings: UserSettings, **fields) -> UserSettings:
    for key, value in fields.items():
        if value is not None:
            setattr(settings, key, value)
    await db.commit()
    return settings
