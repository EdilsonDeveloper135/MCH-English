from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url: str
    redis_url: str
    secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    # Dictation WAV cache lives on a mounted volume, not in Postgres (see
    # tts_service.py) -- avoids bloating the relational DB with binary blobs.
    audio_cache_dir: str = "/app/audio_cache"


settings = Settings()
