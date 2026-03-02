"""
schemas/auth.py
Fleet Management System

Auth-specific request/response schemas.
Note: login response does NOT include tokens in the body —
tokens are HttpOnly cookies set by the auth router.
The frontend only needs the User object back.
"""

from __future__ import annotations
from typing import Optional
from pydantic import EmailStr
from schemas.common import CamelBase, UserRole
from schemas.users import UserResponse


class LoginRequest(CamelBase):
    """POST /auth/token"""
    email:    EmailStr
    password: str


class LoginResponse(CamelBase):
    """
    POST /auth/token response body.
    Tokens are in HttpOnly cookies — not in the body.
    Frontend auth-api.ts only reads `user` from this response.
    Wire shape: { "message": "Login successful", "user": { ...UserResponse } }
    """
    message: str
    user:    UserResponse


class RegisterRequest(CamelBase):
    """
    POST /auth/register — ADMIN creates users in this system.
    No self-service registration; role is explicitly set by admin.
    """
    email:      EmailStr
    password:   str
    first_name: str        # → firstName
    last_name:  str        # → lastName
    role:       UserRole = UserRole.DRIVER
    phone:      Optional[str] = None


class ForgetPasswordRequest(CamelBase):
    """POST /auth/forgot_password"""
    email: EmailStr


class PasswordResetConfirm(CamelBase):
    """POST /auth/reset_password"""
    token:        str
    new_password: str      # → newPassword (was newpassword — fixed casing)