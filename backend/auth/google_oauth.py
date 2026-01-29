from typing import Any
from urllib.parse import urlencode
import httpx
from fastapi import HTTPException
from auth.tokens import generate_state_token
from core.config import  get_settings

settings = get_settings()
class GoogleOAuth:
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USER_INFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

    @staticmethod
    async def get_authorization_url(redirect_url: str, prompt: str) -> str:
        state = generate_state_token(redirect_url)
        params = {

            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URL,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }

        return f"{GoogleOAuth.AUTHORIZATION_URL}?{urlencode(params)}"


    @staticmethod
    async def exchange_code_for_token(code: str)-> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GoogleOAuth.TOKEN_URL,
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.GOOGLE_REDIRECT_URL,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                }
            )
            if response.status_code != 200:
                raise HTTPException(400, f"Google token exchange failed {response.text}")

            return response.json()

    @staticmethod
    async def get_google_user_info(token: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GoogleOAuth.USER_INFO_URL,
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code != 200:
                raise ValueError(f"Failed to get user information", response.text)

            return response.json()

    @staticmethod
    async def refresh_access_token(token: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GoogleOAuth.TOKEN_URL,
                data = {
                    "grant_type": "refresh_token",
                    "refresh_token": token,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                }
            )

            if response.status_code != 200:
                raise ValueError(f"Failed to refresh access token", response.text)

            return response.json()

google_oauth = GoogleOAuth()



