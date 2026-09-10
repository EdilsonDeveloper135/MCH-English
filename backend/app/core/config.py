import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url: str
    redis_url: str
    secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit_enabled: bool = True
    # Dictation WAV cache lives on a mounted volume, not in Postgres (see
    # tts_service.py) -- avoids bloating the relational DB with binary blobs.
    audio_cache_dir: str = "/app/audio_cache"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [i.strip() for i in v_stripped.split(",") if i.strip()]
        if isinstance(v, (list, tuple)):
            return [str(i) for i in v]
        return ["http://localhost:3000"]


settings = Settings()

