from starlette.responses import Response
from core.config import get_settings

settings = get_settings()

def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,   # Literal["lax","strict","none"] — no warning
        max_age=settings.ACCESS_TOKEN_MAX_AGE_SECONDS,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_MAX_AGE_SECONDS,
        path="/auth/refresh",  # scoped — refresh token only sent to refresh endpoint
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear both auth cookies (logout)."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth/refresh")