"""
services/storage.py
Fleet Management System

Single storage abstraction layer.
Swap between local filesystem and Cloudinary by setting CLOUDINARY_URL in .env.

Cloudinary setup (free tier, 25GB storage):
  1. Sign up at cloudinary.com
  2. Copy your "API Environment variable" from the dashboard
  3. Add to .env:  CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
  4. pip install cloudinary

Without CLOUDINARY_URL set, falls back to local /static/ storage.
"""

from __future__ import annotations

import os
import shutil
import uuid
from fastapi import HTTPException, UploadFile

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES     = 5 * 1024 * 1024   # 5 MB

# Detect which backend to use at import time
_CLOUDINARY_URL = os.getenv("CLOUDINARY_URL")
_USE_CLOUDINARY = bool(_CLOUDINARY_URL)

if _USE_CLOUDINARY:
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(cloudinary_url=_CLOUDINARY_URL)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC INTERFACE
# ─────────────────────────────────────────────────────────────────────────────

async def upload_image(
    file:      UploadFile,
    folder:    str,          # e.g. "avatars", "trucks", "trailers"
    record_id: str,          # used as public_id prefix for easy GC
) -> str:
    """
    Validate and upload an image. Returns the public URL string.
    Raises HTTPException on validation failure or upload error.
    """
    _validate(file)

    if _USE_CLOUDINARY:
        return await _upload_cloudinary(file, folder, record_id)
    else:
        return await _upload_local(file, folder, record_id)


async def delete_image(url: str | None) -> None:
    """
    Best-effort delete of a previously uploaded image.
    Never raises — failures are silently ignored (non-fatal).
    """
    if not url:
        return
    try:
        if _USE_CLOUDINARY:
            _delete_cloudinary(url)
        else:
            _delete_local(url)
    except Exception:
        pass   # deletion failure is never fatal


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def _validate(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            422,
            f"Unsupported file type '{file.content_type}'. Use JPEG, PNG, or WebP.",
        )
    if file.size and file.size > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image must be under 5 MB.")


# ─────────────────────────────────────────────────────────────────────────────
# CLOUDINARY BACKEND
# ─────────────────────────────────────────────────────────────────────────────

async def _upload_cloudinary(file: UploadFile, folder: str, record_id: str) -> str:
    public_id = f"fleetms/{folder}/{record_id}_{uuid.uuid4().hex[:8]}"
    try:
        result = cloudinary.uploader.upload(
            file.file,
            public_id=public_id,
            overwrite=True,
            resource_type="image",
            # Automatically resize to max 800px wide — saves bandwidth
            transformation=[{"width": 800, "crop": "limit", "quality": "auto"}],
        )
        return result["secure_url"]   # https://res.cloudinary.com/...
    except Exception as exc:
        raise HTTPException(500, f"Cloudinary upload failed: {exc}") from exc


def _delete_cloudinary(url: str) -> None:
    # Extract public_id from URL: .../fleetms/trucks/abc123.jpg → fleetms/trucks/abc123
    # Cloudinary URLs look like: https://res.cloudinary.com/<cloud>/image/upload/v123/<public_id>.<ext>
    try:
        part = url.split("/upload/")[-1]             # v123/fleetms/trucks/abc.jpg
        part = part.split("/", 1)[-1]                # fleetms/trucks/abc.jpg
        public_id = part.rsplit(".", 1)[0]           # fleetms/trucks/abc
        cloudinary.uploader.destroy(public_id)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# LOCAL FILESYSTEM BACKEND  (dev / Docker)
# ─────────────────────────────────────────────────────────────────────────────

async def _upload_local(file: UploadFile, folder: str, record_id: str) -> str:
    directory = f"static/{folder}"
    os.makedirs(directory, exist_ok=True)

    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    filename = f"{record_id}_{uuid.uuid4().hex[:10]}.{ext}"
    filepath = os.path.join(directory, filename)

    try:
        with open(filepath, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except OSError as exc:
        raise HTTPException(500, f"Failed to save image: {exc}") from exc

    return f"/static/{folder}/{filename}"


def _delete_local(url: str) -> None:
    # url is like /static/trucks/abc.jpg
    path = url.lstrip("/")
    if os.path.isfile(path):
        os.remove(path)