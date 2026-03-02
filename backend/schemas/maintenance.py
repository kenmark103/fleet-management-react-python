"""
schemas/maintenance.py
Fleet Management System
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from schemas.common import CamelBase, WorkOrderStatus, WorkOrderPriority, ServiceIntervalType


class WorkOrderPartBase(CamelBase):
    part_name:   str
    part_number: Optional[str] = None
    quantity:    int
    unit_cost:   float
    total_cost:  float
    currency:    str = "USD"


class WorkOrderPartResponse(WorkOrderPartBase):
    id:            str
    work_order_id: str


class WorkOrderBase(CamelBase):
    truck_id:             str
    assigned_mechanic_id: str
    priority:             WorkOrderPriority
    title:                str
    description:          str
    scheduled_date:       datetime
    odometer_at_service:  Optional[float] = None
    estimated_cost:       Optional[float] = None
    currency:             str = "USD"
    notes:                Optional[str]   = None


class WorkOrderCreate(WorkOrderBase):
    """POST /maintenance — ADMIN or MECHANIC"""
    pass


class WorkOrderUpdate(CamelBase):
    """PATCH /maintenance/{id}"""
    status:              Optional[WorkOrderStatus]   = None
    priority:            Optional[WorkOrderPriority] = None
    title:               Optional[str]               = None
    description:         Optional[str]               = None
    scheduled_date:      Optional[datetime]          = None
    completed_date:      Optional[datetime]          = None
    actual_cost:         Optional[float]             = None
    odometer_at_service: Optional[float]             = None
    notes:               Optional[str]               = None


class WorkOrderResponse(WorkOrderBase):
    """GET /maintenance  |  GET /maintenance/{id}"""
    id:                str
    work_order_number:  str
    status:             WorkOrderStatus
    completed_date:     Optional[datetime]          = None
    actual_cost:        Optional[float]             = None
    parts:              list[WorkOrderPartResponse] = []
    created_by:         str
    created_at:         datetime
    updated_at:         datetime


class ServiceScheduleBase(CamelBase):
    truck_id:             str
    service_type:         str
    interval_type:        ServiceIntervalType
    interval_value:       int
    reminder_days_before: int = 7
    is_active:            bool = True


class ServiceScheduleCreate(ServiceScheduleBase):
    """POST /maintenance/schedules — ADMIN or MECHANIC"""
    pass


class ServiceScheduleResponse(ServiceScheduleBase):
    """GET /maintenance/schedules"""
    id:                    str
    last_service_date:     Optional[datetime] = None
    last_service_odometer: Optional[float]    = None
    next_service_date:     Optional[datetime] = None
    next_service_odometer: Optional[float]    = None
    created_by:            str
    created_at:            datetime
    updated_at:            datetime