"""
schemas/users.py
Fleet Management System

User schemas — imported by auth router and users router.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import EmailStr
from schemas.common import CamelBase, UserRole


class UserBase(CamelBase):
    email:      EmailStr
    first_name: str        # → firstName
    last_name:  str        # → lastName
    role:       UserRole
    phone:      Optional[str] = None
    avatar_url: Optional[str] = None  # → avatarUrl


class UserCreate(UserBase):
    """POST /settings/users — ADMIN only"""
    password: str


class UserUpdate(CamelBase):
    """PATCH /settings/users/{id} — ADMIN only"""
    first_name: Optional[str]      = None
    last_name:  Optional[str]      = None
    role:       Optional[UserRole] = None
    phone:      Optional[str]      = None
    is_active:  Optional[bool]     = None  # → isActive


class UserResponse(UserBase):
    id:            str
    is_active:     bool                   # → isActive
    is_verified:   bool                   # → isVerified
    created_at:    datetime               # → createdAt
    updated_at:    datetime               # → updatedAt
    last_login_at: Optional[datetime] = None  # → lastLoginAt