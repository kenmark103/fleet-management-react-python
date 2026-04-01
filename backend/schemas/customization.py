from __future__ import annotations

from datetime import datetime
from typing import Optional

from schemas.common import CamelBase


class DashboardWidgetConfig(CamelBase):
    code: str
    visible: bool = True
    order: int = 0
    title: Optional[str] = None
    filters: dict = {}


class DashboardPreferencesResponse(CamelBase):
    user_id: str
    dashboard_template_id: Optional[str] = None
    widgets: list[DashboardWidgetConfig] = []
    layout: dict = {}
    updated_at: datetime


class DashboardPreferencesUpdate(CamelBase):
    dashboard_template_id: Optional[str] = None
    widgets: list[DashboardWidgetConfig] = []
    layout: dict = {}


class DashboardTemplateResponse(CamelBase):
    id: str
    name: str
    description: Optional[str] = None
    config_json: dict


class SavedReportResponse(CamelBase):
    id: str
    user_id: str
    name: str
    report_type: str
    filters_json: dict
    config_json: dict
    created_at: datetime
    updated_at: datetime


class SavedReportCreate(CamelBase):
    name: str
    report_type: str
    filters_json: dict = {}
    config_json: dict = {}


class ReportWidgetConfigResponse(CamelBase):
    id: str
    code: str
    name: str
    category: str
    config_json: dict
