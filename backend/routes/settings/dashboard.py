from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from auth.deps import get_current_user
from db.dbconfig import DB
from db.models import DashboardTemplate, User, UserDashboardPreference
from schemas.common import ApiResponse
from schemas.customization import (
    DashboardPreferencesResponse,
    DashboardPreferencesUpdate,
    DashboardTemplateResponse,
)

router = APIRouter(prefix='/settings/dashboard', tags=['settings:dashboard'])


async def _get_or_create_preference(db: DB, user_id: str) -> UserDashboardPreference:
    pref = (await db.execute(select(UserDashboardPreference).where(UserDashboardPreference.user_id == user_id))).scalar_one_or_none()
    if pref:
        return pref
    pref = UserDashboardPreference(user_id=user_id, widgets_json={}, layout_json={})
    db.add(pref)
    await db.commit()
    await db.refresh(pref)
    return pref


@router.get('', response_model=ApiResponse[DashboardPreferencesResponse])
async def get_dashboard_preferences(db: DB, current_user: User = Depends(get_current_user)):
    pref = await _get_or_create_preference(db, current_user.id)
    templates = (await db.execute(select(DashboardTemplate).order_by(DashboardTemplate.name.asc()))).scalars().all()
    return ApiResponse(data=DashboardPreferencesResponse(
        user_id=current_user.id,
        dashboard_template_id=pref.dashboard_template_id,
        widgets=pref.widgets_json.get('widgets', []),
        layout=pref.layout_json,
        updated_at=pref.updated_at,
    ))


@router.patch('', response_model=ApiResponse[DashboardPreferencesResponse])
async def update_dashboard_preferences(body: DashboardPreferencesUpdate, db: DB, current_user: User = Depends(get_current_user)):
    pref = await _get_or_create_preference(db, current_user.id)
    pref.dashboard_template_id = body.dashboard_template_id
    pref.widgets_json = {'widgets': [item.model_dump() for item in body.widgets]}
    pref.layout_json = body.layout
    await db.commit()
    await db.refresh(pref)
    return ApiResponse(data=DashboardPreferencesResponse(
        user_id=current_user.id,
        dashboard_template_id=pref.dashboard_template_id,
        widgets=body.widgets,
        layout=pref.layout_json,
        updated_at=pref.updated_at,
    ), message='Dashboard preferences updated')


@router.get('/templates', response_model=ApiResponse[list[DashboardTemplateResponse]])
async def list_dashboard_templates(db: DB, _: User = Depends(get_current_user)):
    rows = (await db.execute(select(DashboardTemplate).order_by(DashboardTemplate.name.asc()))).scalars().all()
    return ApiResponse(data=[DashboardTemplateResponse.model_validate(row) for row in rows])
