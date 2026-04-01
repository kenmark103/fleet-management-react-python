from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from auth.deps import get_current_user, require_roles
from db.dbconfig import DB
from db.models import ReportWidgetConfig, User
from schemas.common import ApiResponse
from schemas.customization import ReportWidgetConfigResponse

router = APIRouter(prefix='/widgets', tags=['widgets'])


@router.get('/catalog', response_model=ApiResponse[list[ReportWidgetConfigResponse]])
async def widget_catalog(db: DB, _: User = Depends(get_current_user)):
    rows = (await db.execute(select(ReportWidgetConfig).order_by(ReportWidgetConfig.category.asc(), ReportWidgetConfig.name.asc()))).scalars().all()
    return ApiResponse(data=[ReportWidgetConfigResponse.model_validate(row) for row in rows])
