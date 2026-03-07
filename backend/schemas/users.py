"""
schemas/user.py
Fleet Management System — Phase 8

User management schemas:
  - UserResponse / UserListItem     ← GET endpoints
  - UserCreate                      ← POST /settings/users  (admin)
  - UserUpdate                      ← PATCH /settings/users/{id}  (admin)
  - AdminPasswordReset              ← POST /settings/users/{id}/reset-password
  - ProfileUpdate                   ← PATCH /settings/profile  (own)
  - ChangePasswordRequest           ← PATCH /settings/profile/change-password
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, field_validator, model_validator

from schemas.common import CamelBase, UserRole


# ─────────────────────────────────────────────────────────────────────────────
# READ SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class UserResponse(CamelBase):
    """Full user object — returned for single-item endpoints."""
    id:            str
    first_name:    str        # → firstName
    last_name:     str        # → lastName
    email:         str
    role:          UserRole
    is_active:     bool       # → isActive
    is_verified:   bool       # → isVerified
    phone:         Optional[str] = None
    avatar_url:    Optional[str] = None  # → avatarUrl
    last_login_at: Optional[datetime] = None  # → lastLoginAt
    created_at:    datetime   # → createdAt
    updated_at:    datetime   # → updatedAt


class UserListItem(CamelBase):
    """Lightweight user object — used in paginated list responses."""
    id:            str
    first_name:    str
    last_name:     str
    email:         str
    role:          UserRole
    is_active:     bool
    phone:         Optional[str] = None
    avatar_url:    Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at:    datetime


# ─────────────────────────────────────────────────────────────────────────────
# WRITE SCHEMAS  — Admin user management
# ─────────────────────────────────────────────────────────────────────────────

class UserCreate(CamelBase):
    """
    Admin creates a new user.
    - temp_password: admin sets a known password; user changes it on first login.
    - is_verified defaults True — admin-created accounts skip email verification.
    """
    first_name:    str
    last_name:     str
    email:         EmailStr
    role:          UserRole
    phone:         Optional[str] = None
    temp_password: str   # → tempPassword

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()

    @field_validator("temp_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def no_driver_role(cls, v: str) -> str:
        if v == "DRIVER":
            raise ValueError("DRIVER role must be created via /drivers endpoint")
        return v


class UserUpdate(CamelBase):
    """
    Admin patches an existing user.
    All fields optional — only supplied fields are updated.
    """
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    email:      Optional[EmailStr] = None
    role:       Optional[UserRole] = None
    phone:      Optional[str] = None
    is_active:  Optional[bool] = None


class AdminPasswordReset(CamelBase):
    """Admin resets a user's password — no current password required."""
    new_password: str   # → newPassword

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# WRITE SCHEMAS  — Own profile  (all roles)
# ─────────────────────────────────────────────────────────────────────────────

class ProfileUpdate(CamelBase):
    """
    User updates their own profile.
    Email and role are intentionally excluded — only admin can change those.
    """
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    phone:      Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ProfileUpdate":
        if all(v is None for v in [self.first_name, self.last_name, self.phone]):
            raise ValueError("At least one field must be provided")
        return self


class ChangePasswordRequest(CamelBase):
    """User changes their own password — current password required."""
    current_password: str   # → currentPassword
    new_password:     str   # → newPassword

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v