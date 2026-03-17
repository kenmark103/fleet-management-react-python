"""
schemas/users.py
Fleet Management System — Phase 8 → Phase 10 (invite flow)

Changes:
  - UserCreate: removed temp_password — admin no longer sets passwords
  - UserResponse / UserListItem: added status field
  - AcceptInviteRequest: new — used by POST /auth/accept-invite
  - InviteInfoResponse: new — used by GET /auth/invite-info
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, field_validator, model_validator

from schemas.common import CamelBase, UserRole, UserStatus


# ─────────────────────────────────────────────────────────────────────────────
# READ SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class UserResponse(CamelBase):
    """Full user object — returned for single-item endpoints."""
    id:            str
    first_name:    str
    last_name:     str
    email:         str
    role:          UserRole
    status:        UserStatus         # active | inactive | pending
    is_active:     bool
    is_verified:   bool
    phone:         Optional[str]      = None
    avatar_url:    Optional[str]      = None
    last_login_at: Optional[datetime] = None
    created_at:    datetime
    updated_at:    datetime


class UserListItem(CamelBase):
    """Lightweight user object — used in paginated list responses."""
    id:            str
    first_name:    str
    last_name:     str
    email:         str
    role:          UserRole
    status:        UserStatus
    is_active:     bool
    phone:         Optional[str]      = None
    avatar_url:    Optional[str]      = None
    last_login_at: Optional[datetime] = None
    created_at:    datetime


# ─────────────────────────────────────────────────────────────────────────────
# WRITE SCHEMAS  — Admin user management
# ─────────────────────────────────────────────────────────────────────────────

class UserCreate(CamelBase):
    """
    Admin invites a new user.
    No password — user sets their own via the invite link.
    """
    first_name: str
    last_name:  str
    email:      EmailStr
    role:       UserRole
    phone:      Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class UserUpdate(CamelBase):
    """Admin patches an existing user. All fields optional."""
    first_name: Optional[str]      = None
    last_name:  Optional[str]      = None
    email:      Optional[EmailStr] = None
    role:       Optional[UserRole] = None
    phone:      Optional[str]      = None
    is_active:  Optional[bool]     = None


class AdminPasswordReset(CamelBase):
    """Admin resets a user's password — no current password required."""
    new_password: str

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
    """User updates their own profile. Email and role are admin-only."""
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
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# INVITE FLOW
# ─────────────────────────────────────────────────────────────────────────────

class AcceptInviteRequest(CamelBase):
    """
    POST /auth/accept-invite
    User sets their password (and optionally updates name/phone)
    using the token from their invite email.
    """
    token:      str
    password:   str
    first_name: Optional[str] = None   # user can confirm/correct their name
    last_name:  Optional[str] = None
    phone:      Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class InviteInfoResponse(CamelBase):
    """
    GET /auth/invite-info?token=xxx
    Returns enough info to pre-fill the accept-invite form.
    Never returns sensitive data — token is already validated.
    """
    first_name: str
    last_name:  str
    email:      str
    role:       str