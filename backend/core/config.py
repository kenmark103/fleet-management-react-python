from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRY_IN_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRY_IN_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRY_IN_DAYS: int = 1
    DATABASE_URL: str
    TEST_DATABASE_URL: str

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    FRONTEND_URL: str
    GOOGLE_REDIRECT_URL: str
    FRONTEND_OAUTH_SUCCESS: str
    FRONTEND_REDIRECT_URL: str

    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    FRONTEND_RESET_URL: str


    model_config = SettingsConfigDict(
        env_file=('.env', '.env.example')
    )

settings = Settings()
