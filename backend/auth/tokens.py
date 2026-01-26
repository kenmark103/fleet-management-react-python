import secrets
from datetime import datetime, timedelta
from typing import Dict
from fastapi import HTTPException
from jose import jwt, JWTError, ExpiredSignatureError
from core.config import settings


def create_access_token(data: Dict):
     return jwt.encode(
        {**data, "exp": datetime.now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRY_IN_MINUTES)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

def create_refresh_token(data: dict):
    return jwt.encode(
        {**data, "exp": datetime.now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRY_IN_DAYS)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

def generate_reset_password_token(data: dict):
    return jwt.encode(
        {**data, "exp": datetime.now() + timedelta(days=settings.PASSWORD_RESET_TOKEN_EXPIRY_IN_DAYS)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

def generate_email_verification_token():
    return secrets.token_urlsafe(32)

def generate_state_token(redirect_url: str):
    state_data = {
        "redirect_url" : redirect_url,
        "nonce": secrets.token_urlsafe(32),
        "exp": datetime.now() + timedelta(minutes=10),
    }

    return jwt.encode(state_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def extract_redirect_url_from_state(state: str):
    payload = decode_token(state)
    return payload["redirect_url"]


def decode_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return  payload

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


