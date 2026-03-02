from typing import Optional

from fastapi import APIRouter, HTTPException
from starlette.responses import RedirectResponse

from auth.google_oauth import google_oauth
from auth.cookies import set_auth_cookies          # ← updated import path
from auth.tokens import create_access_token, create_refresh_token, decode_token
from core.config import get_settings
from db.dbconfig import DB
from services.oauth_service import find_or_create_user_from_google

router = APIRouter(prefix="/google", tags=["google oauth"])
settings = get_settings()


@router.get("/login")
async def google_login(
    redirect_url: Optional[str] = None,
    prompt: Optional[str] = "select_account",
):
    redirect_url = redirect_url or settings.GOOGLE_REDIRECT_URL
    auth_url = await google_oauth.get_authorization_url(redirect_url, prompt)
    return RedirectResponse(auth_url)


@router.get("/callback")
async def google_oauth_callback(code: str, state: str, db: DB):
    if not decode_token(state):
        raise HTTPException(400, "Invalid state parameter")

    google_tokens = await google_oauth.exchange_code_for_token(code)
    userinfo = await google_oauth.get_google_user_info(google_tokens["access_token"])

    user, is_new_user = await find_or_create_user_from_google(db, userinfo, google_tokens)

    data = {"email": user.email, "role": user.role}
    access_token  = create_access_token(data)
    refresh_token = create_refresh_token(data)

    success_url = settings.FRONTEND_OAUTH_SUCCESS or f"{settings.FRONTEND_URL}/dashboard"
    redirect = RedirectResponse(url=success_url)

    set_auth_cookies(redirect, access_token, refresh_token)

    return redirect