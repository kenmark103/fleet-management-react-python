from anyio.functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRY_IN_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRY_IN_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRY_IN_DAYS: int = 1
    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None

    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None

    FRONTEND_URL: str | None = None
    GOOGLE_REDIRECT_URL: str | None = None
    FRONTEND_OAUTH_SUCCESS: str | None = None
    FRONTEND_REDIRECT_URL: str | None = None

    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_FROM: str | None = None
    MAIL_PORT: int | None = None
    MAIL_SERVER: str | None = None
    MAIL_FROM_NAME: str | None = None
    FRONTEND_RESET_URL: str | None = None
    NGROK_AUTHTOKEN: str


    model_config = SettingsConfigDict(
        env_file=('.env', '.env.example')
    )

@lru_cache
def get_settings():
    return Settings()
