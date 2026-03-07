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

router = APIRouter(prefix="/settings/profile", tags=["settings:profile"])

# ── Avatar storage ────────────────────────────────────────────────────────────
AVATAR_DIR = "static/avatars"
AVATAR_URL_PREFIX = "/static/avatars"
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024   # 5 MB

os.makedirs(AVATAR_DIR, exist_ok=True)


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
    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            422,
            f"Unsupported file type '{file.content_type}'. "
            "Please upload a JPEG, PNG, or WebP image.",
        )

    # Validate file size (UploadFile.size is set when content-length header present)
    if file.size and file.size > MAX_AVATAR_BYTES:
        raise HTTPException(413, "Avatar must be under 5 MB")

    # Build unique filename — keyed by user ID so old avatars are easy to GC
    ext = (file.filename or "avatar").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:10]}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)

    # Write to disk (swap this block for S3/GCS put_object if needed)
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except OSError as exc:
        raise HTTPException(500, f"Failed to save avatar: {exc}") from exc

    # Optionally clean up previous avatar file
    if current_user.avatar_url:
        old_filename = current_user.avatar_url.rsplit("/", 1)[-1]
        old_path = os.path.join(AVATAR_DIR, old_filename)
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass   # Non-fatal

    current_user.avatar_url = f"{AVATAR_URL_PREFIX}/{filename}"
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