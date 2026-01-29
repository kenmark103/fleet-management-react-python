from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.responses import RedirectResponse
from auth.google_oauth import google_oauth
from auth.tokens import  create_access_token, create_refresh_token, decode_token
from core.config import get_settings
from db.dbconfig import DB
from schemas.tokens import TokenResponse
from services.oauth_service import handle_frontend_redirect, find_or_create_user_from_google

router = APIRouter(prefix='/google', tags=["google oauth"])
settings = get_settings()

@router.get("/login")
async def google_login(redirect_url: Optional[str] = Query(None), prompt: Optional[str] = Query("Select Account") ):
    redirect_url = redirect_url or settings.FRONTEND_REDIRECT_URL
    auth_url = await google_oauth.get_authorization_url(redirect_url, prompt)
    return RedirectResponse(auth_url)

@router.get("/callback")
async def google_oauth_callback(code: str, state: str, db: DB)->TokenResponse:
    if not decode_token(state):
        raise HTTPException(400, 'Invalid state parameter')

    google_tokens = await google_oauth.exchange_code_for_token(code)

    userinfo = await google_oauth.get_google_user_info(google_tokens["access_token"])

    user, is_new_user = await find_or_create_user_from_google(db, userinfo, google_tokens)

    data = {"email":user.email, "role":user.role }

    access_token = create_access_token(data)
    refresh_token = create_refresh_token(data)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, token_type="bearer")


