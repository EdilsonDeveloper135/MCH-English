from typing import Literal

from pydantic import BaseModel, Field

TranslationMode = Literal["learning", "immersion", "assisted"]


class UserSettingsOut(BaseModel):
    translation_mode: TranslationMode
    daily_goal_minutes: int


class UserSettingsUpdate(BaseModel):
    translation_mode: TranslationMode | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=1, le=480)
