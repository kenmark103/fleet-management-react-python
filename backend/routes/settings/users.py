"""
routers/settings/users.py
Fleet Management System — Phase 8

ADMIN-only user management endpoints:
  GET    /settings/users                      list + search/filter/paginate
  POST   /settings/users                      create user with temp password
  GET    /settings/users/{user_id}            get single user
  PATCH  /settings/users/{user_id}            update user fields
  DELETE /settings/users/{user_id}            soft-deactivate (is_active=False)
  POST   /settings/users/{user_id}/reset-password   admin resets password
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select

from auth.security import hash_password
from db.dbconfig import DB
from db.models import User
from auth.deps import require_admin
from schemas.common import ApiResponse, PaginatedResponse, PaginationMeta, UserRole
from schemas.users import (
    AdminPasswordReset,
    UserCreate,
    UserListItem,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/settings/users", tags=["settings:users"])


# ─────────────────────────────────────────────────────────────────────────────
# LIST  GET /settings/users
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[UserListItem])
async def list_users(
    db: DB,
    current_user: User = Depends(require_admin),
    q: Optional[str] = Query(None, description="Search first name, last name, or email"),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = select(User)

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
            )
        )

    if role is not None:
        stmt = stmt.where(User.role == role.value)

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    # Total count (before pagination)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    users = (await db.execute(stmt)).scalars().all()

    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[UserListItem](
        data=[UserListItem.model_validate(u) for u in users],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next_page=page < total_pages,
            has_previous_page=page > 1,
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# CREATE  POST /settings/users
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=ApiResponse[UserResponse], status_code=201)
async def create_user(
    body: UserCreate,
    db: DB,
    current_user: User = Depends(require_admin),
):
    # Enforce email uniqueness
    existing = (
        await db.execute(select(User).where(User.email == body.email))
    ).scalars().first()
    if existing:
        raise HTTPException(409, "A user with this email already exists")

    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        role=body.role.value,
        phone=body.phone,
        password=hash_password(body.temp_password),
        is_active=True,
        is_verified=True,   # Admin-created users bypass email verification
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return ApiResponse[UserResponse](
        data=UserResponse.model_validate(user),
        message=f"User {user.first_name} {user.last_name} created successfully",
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET SINGLE  GET /settings/users/{user_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=ApiResponse[UserResponse])
async def get_user(
    user_id: str,
    db: DB,
    current_user: User = Depends(require_admin),
):
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise HTTPException(404, "User not found")

    return ApiResponse[UserResponse](data=UserResponse.model_validate(user))


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE  PATCH /settings/users/{user_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{user_id}", response_model=ApiResponse[UserResponse])
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: DB,
    current_user: User = Depends(require_admin),
):
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise HTTPException(404, "User not found")

    # Safety: admin cannot deactivate their own account
    if user.id == current_user.id and body.is_active is False:
        raise HTTPException(400, "You cannot deactivate your own account")

    update_data = body.model_dump(exclude_none=True)

    # Validate new email uniqueness
    if "email" in update_data:
        clash = (
            await db.execute(
                select(User).where(
                    User.email == update_data["email"],
                    User.id != user_id,
                )
            )
        ).scalars().first()
        if clash:
            raise HTTPException(409, "Email is already in use by another user")

    # Unwrap role enum → raw string for SQLAlchemy
    if "role" in update_data and hasattr(update_data["role"], "value"):
        update_data["role"] = update_data["role"].value

    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return ApiResponse[UserResponse](
        data=UserResponse.model_validate(user),
        message="User updated successfully",
    )


# ─────────────────────────────────────────────────────────────────────────────
# DEACTIVATE  DELETE /settings/users/{user_id}  (soft delete)
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{user_id}", response_model=ApiResponse[UserResponse])
async def deactivate_user(
    user_id: str,
    db: DB,
    current_user: User = Depends(require_admin),
):
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user.id:
        raise HTTPException(400, "You cannot deactivate your own account")

    user.is_active = False
    await db.commit()
    await db.refresh(user)

    return ApiResponse[UserResponse](
        data=UserResponse.model_validate(user),
        message=f"{user.first_name} {user.last_name} has been deactivated",
    )


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN PASSWORD RESET  POST /settings/users/{user_id}/reset-password
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{user_id}/reset-password", response_model=ApiResponse[dict])
async def admin_reset_password(
    user_id: str,
    body: AdminPasswordReset,
    db: DB,
    current_user: User = Depends(require_admin),
):
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise HTTPException(404, "User not found")

    user.password = hash_password(body.new_password)
    user.reset_password_token = None   # Invalidate any pending reset tokens
    await db.commit()

    return ApiResponse[dict](
        data={},
        message=f"Password for {user.first_name} {user.last_name} has been reset",
    )