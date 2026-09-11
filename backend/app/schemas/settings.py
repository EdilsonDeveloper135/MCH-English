from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

TranslationMode = Literal["learning", "immersion", "assisted"]


class UserSettingsOut(BaseModel):
    translation_mode: TranslationMode
    daily_goal_minutes: int
    timezone: str = "UTC"


class UserSettingsUpdate(BaseModel):
    translation_mode: TranslationMode | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=1, le=480)
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        candidate = v.strip()
        try:
            ZoneInfo(candidate)
            return candidate
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(f"Zona horaria inválida: {candidate}") from exc

