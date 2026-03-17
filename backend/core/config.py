"""
core/config.py
Fleet Management System

Central settings — all config read from environment variables / .env file.
Cookie settings are included here so nothing is hardcoded in auth/cookies.py.

ENVIRONMENT STRATEGY
────────────────────
.env              — real secrets, never committed (in .gitignore)
.env.example      — committed, shows every key with safe placeholder values
CI (GitHub Actions) — secrets set directly as repository/environment secrets,
                      no .env file needed at all

NON-SECRET DEFAULTS (safe to commit in .env.example with real values):
  ALGORITHM, ACCESS_TOKEN_EXPIRY_IN_MINUTES, REFRESH_TOKEN_EXPIRY_IN_DAYS,
  PASSWORD_RESET_TOKEN_EXPIRY_IN_DAYS, COOKIE_SECURE, COOKIE_SAMESITE,
  ACCESS_TOKEN_MAX_AGE_SECONDS, REFRESH_TOKEN_MAX_AGE_SECONDS,
  MAIL_PORT, MAIL_SERVER, MAIL_FROM_NAME

SECRET — must be in .env locally and CI secrets in production:
  SECRET_KEY, DATABASE_URL, TEST_DATABASE_URL,
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM,
  NGROK_AUTHTOKEN, FRONTEND_URL, GOOGLE_REDIRECT_URL, etc.
"""

from __future__ import annotations
from typing import Literal, List
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


# ─────────────────────────────────────────────────────────────────────────────
# SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

class Settings(BaseSettings):

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str                                   # required — no default
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRY_IN_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRY_IN_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRY_IN_DAYS: int = 1
    ENVIRONMENT: str

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str                                 # required — no default
    TEST_DATABASE_URL: str | None = None

    # ── Cookies ───────────────────────────────────────────────────────────────
    # COOKIE_SECURE: False in local dev (HTTP), True in production (HTTPS).
    # Stored as bool — set COOKIE_SECURE=true in production .env / CI secret.
    COOKIE_SECURE: bool = False

    # COOKIE_SAMESITE must be one of: lax | strict | none
    # Starlette's set_cookie() is typed as Literal["lax", "strict", "none"].
    # Storing as str here and casting at point of use fixes the warning.
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    ACCESS_TOKEN_MAX_AGE_SECONDS: int = 60 * 30          # 30 min
    REFRESH_TOKEN_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 7  # 7 days

    # ── OAuth (Google) ────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URL: str | None = None

    # ── Frontend URLs ─────────────────────────────────────────────────────────
    FRONTEND_URL: str | None = None
    FRONTEND_OAUTH_SUCCESS: str | None = None
    FRONTEND_REDIRECT_URL: str | None = None
    FRONTEND_RESET_URL: str | None = None

    # ── Email ─────────────────────────────────────────────────────────────────
    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_FROM: str | None = MAIL_USERNAME
    MAIL_PORT: int | None = 587
    MAIL_SERVER: str | None = "smtp.gmail.com"
    MAIL_FROM_NAME: str | None = "Fleet Management System"

    # ── Misc ──────────────────────────────────────────────────────────────────
    NGROK_AUTHTOKEN: str | None = None

    # ── Storage ──────────────────────────────────────────────────────────────────
    CLOUDINARY_URL: str | None = None

    model_config = SettingsConfigDict(
        env_file=(".env",),
        extra="ignore",
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()