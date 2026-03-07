from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import Response

from auth.cookies import set_auth_cookies, clear_auth_cookies
from auth.security import verify_password, hash_password
from auth.tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_email_verification_token,
    generate_reset_password_token,
)
from auth.email_utils import send_password_reset_email, send_verification_email
from auth.deps import get_current_user   # your existing dependency
from core.config import get_settings
from core.rate_limiter import limiter
from db.dbconfig import DB
from db.models import User
from schemas.auth import LoginRequest, RegisterRequest, ForgetPasswordRequest, PasswordResetConfirm, LoginResponse
from schemas.users import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

# ─── GET /auth/me ─────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    """
    Returns the currently authenticated user.
    Called by auth-context.tsx on every page load to hydrate the session.
    Requires a valid access_token cookie.
    """
    return current_user


# ─── POST /auth/token (login) ─────────────────────────────────────────────────
@router.post("/token", response_model=LoginResponse)
@limiter.limit("5 per minute")
async def login(request: Request , response: Response, login_request: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == login_request.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if user.password is None:
        raise HTTPException(
            status_code=400,
            detail="This account uses Google Sign In. Please login with Google.",
        )
    if not verify_password(login_request.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact your administrator.")

    user.last_login_at = datetime.now()
    await db.commit()
    await db.refresh(user)

    # Issue tokens into HttpOnly cookies — NOT in the response body
    data = {"role": user.role, "email": user.email}
    access_token  = create_access_token(data)
    refresh_token = create_refresh_token(data)
    set_auth_cookies(response, access_token, refresh_token)

    # Return user object — frontend auth-context sets this as the current user
    return LoginResponse(
        message="Login successful",
        user=UserResponse.model_validate(user),
    )

# ─── POST /auth/logout ────────────────────────────────────────────────────────
@router.post("/logout")
def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


# ─── POST /auth/refresh ───────────────────────────────────────────────────────
@router.post("/refresh")
async def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token found")

    payload = decode_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    new_access_token = create_access_token({"email": payload["email"], "role": payload["role"]})
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_MAX_AGE_SECONDS,
        path="/",
    )
    return {"message": "Token refreshed"}


# ─── POST /auth/forgot_password ───────────────────────────────────────────────
@router.post("/forgot_password")
async def forgot_password(request: ForgetPasswordRequest, db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Email not found")

    user.reset_password_token = generate_reset_password_token({"email": user.email})
    await db.commit()
    background_tasks.add_task(send_password_reset_email, user.email, user.reset_password_token)
    return {"message": "Password reset link sent — check your email"}


# ─── POST /auth/verify_email ──────────────────────────────────────────────────
@router.post("/verify_email")
async def verify_email(token: str, db: DB):
    result = await db.execute(select(User).where(User.email_verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "Invalid or expired token")

    user.is_verified = True
    user.email_verification_token = None
    await db.commit()
    return {"message": "Email verified successfully"}


# ─── POST /auth/reset_password ────────────────────────────────────────────────
@router.post("/reset_password")
async def reset_password(payload: PasswordResetConfirm, db: DB):
    decoded = decode_token(payload.token)
    if not decoded:
        raise HTTPException(400, "Invalid or expired token")

    result = await db.execute(select(User).where(User.email == decoded["email"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "User not found")

    user.password = hash_password(payload.new_password)
    user.reset_password_token = None
    await db.commit()
    return {"message": "Password reset successful — you can now log in"}