from typing import Literal

from pydantic import BaseModel

TranslationMode = Literal["learning", "immersion", "assisted"]


class UserSettingsOut(BaseModel):
    translation_mode: TranslationMode


class UserSettingsUpdate(BaseModel):
    translation_mode: TranslationMode | None = None
