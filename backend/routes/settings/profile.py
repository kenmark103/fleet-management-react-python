"""
routers/settings/profile.py
Fleet Management System — Phase 8

Own-profile endpoints — available to ALL authenticated roles:
  GET    /settings/profile                        get own profile
  PATCH  /settings/profile                        update own name / phone
  POST   /settings/profile/avatar                 upload avatar (multipart)
  PATCH  /settings/profile/change-password        change own password

Notes:
  - Email and role are read-only here; only ADMIN can change those
    via PATCH /settings/users/{id}.
  - Avatar is stored under static/avatars/ and served as a static mount.
    Swap the storage logic for S3/GCS by replacing + url section.
"""

import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth.security import hash_password, verify_password
from db.dbconfig import DB
from db.models import User
from auth.deps import get_current_active_user
from schemas.common import ApiResponse
from schemas.users import ChangePasswordRequest, ProfileUpdate, UserResponse
from services.storage import delete_image, upload_image

router = APIRouter(prefix="/settings/profile", tags=["settings:profile"])

# ── Avatar storage ────────────────────────────────────────────────────────────
AVATAR_URL_PREFIX = "/static/avatars"
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024   # 5 MB


# ─────────────────────────────────────────────────────────────────────────────
# GET  /settings/profile
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=ApiResponse[UserResponse])
async def get_profile(
    current_user: User = Depends(get_current_active_user),
):
    return ApiResponse[UserResponse](
        data=UserResponse.model_validate(current_user)
    )


# ─────────────────────────────────────────────────────────────────────────────
# PATCH  /settings/profile
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("", response_model=ApiResponse[UserResponse])
async def update_profile(
    body: ProfileUpdate,
    db: DB,
    current_user: User = Depends(get_current_active_user),
):
    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)

    await db.commit()
    await db.refresh(current_user)

    return ApiResponse[UserResponse](
        data=UserResponse.model_validate(current_user),
        message="Profile updated successfully",
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST  /settings/profile/avatar
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/avatar", response_model=ApiResponse[UserResponse])
async def upload_avatar(
        db: DB,
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_active_user),
):
    # Delete old image (no-op if None or Cloudinary handles versioning)
    await delete_image(current_user.avatar_url)

    current_user.avatar_url = await upload_image(
        file=file,
        folder="avatars",
        record_id=current_user.id,
    )
    await db.commit()
    await db.refresh(current_user)

    return ApiResponse[UserResponse](
        data=UserResponse.model_validate(current_user),
        message="Avatar updated successfully",
    )

# ─────────────────────────────────────────────────────────────────────────────
# PATCH  /settings/profile/change-password
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/change-password", response_model=ApiResponse[dict])
async def change_password(
    body: ChangePasswordRequest,
    db: DB,
    current_user: User = Depends(get_current_active_user),
):
    # Users created via OAuth may have no password set
    if not current_user.password:
        raise HTTPException(
            400,
            "Your account uses social login — password change is not available",
        )

    if not verify_password(body.current_password, current_user.password):
        raise HTTPException(400, "Current password is incorrect")

    if body.new_password == body.current_password:
        raise HTTPException(400, "New password must differ from current password")

    current_user.password = hash_password(body.new_password)
    await db.commit()

    return ApiResponse[dict](
        data={},
        message="Password changed successfully",
    )