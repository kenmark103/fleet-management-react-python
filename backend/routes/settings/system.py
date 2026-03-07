"""
routers/settings/system.py
Fleet Management System — System Settings (ADMIN only)

GET  /settings/system     → Read settings (all authenticated)
PATCH /settings/system    → Update settings (ADMIN only)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from db.dbconfig import DB
from db.models import SystemSettings, User
from auth.deps import get_current_user, require_admin
from schemas.common import ApiResponse
from schemas.settings import SystemSettingsResponse, SystemSettingsUpdate

router = APIRouter(prefix="/settings/system", tags=["settings:system"])


async def get_or_create_settings(db: DB) -> SystemSettings:
    """Get existing settings or create defaults."""
    result = await db.execute(select(SystemSettings).where(SystemSettings.id == "global"))
    settings = result.scalars().first()

    if not settings:
        settings = SystemSettings(id="global")
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.get("", response_model=ApiResponse[SystemSettingsResponse])
async def get_settings(
        db: DB,
        current_user: User = Depends(get_current_user),
):
    """Get current system settings. Available to all authenticated users."""
    settings = await get_or_create_settings(db)
    return ApiResponse[SystemSettingsResponse](
        data=SystemSettingsResponse.model_validate(settings)
    )


@router.patch("", response_model=ApiResponse[SystemSettingsResponse])
async def update_settings(
        body: SystemSettingsUpdate,
        db: DB,
        current_user: User = Depends(require_admin),
):
    """Update system settings. ADMIN only."""
    settings = await get_or_create_settings(db)

    update_data = body.model_dump(exclude_none=True)

    for key, value in update_data.items():
        setattr(settings, key, value)

    settings.updated_by = current_user.id
    await db.commit()
    await db.refresh(settings)

    return ApiResponse[SystemSettingsResponse](
        data=SystemSettingsResponse.model_validate(settings),
        message="System settings updated successfully"
    )