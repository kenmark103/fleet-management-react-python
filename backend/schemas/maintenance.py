"""
schemas/maintenance.py
Fleet Management System — Phase 7

Synced to:
  - db/models.py  WorkOrder, WorkOrderPart, ServiceSchedule (field names verified)
  - schemas/common.py  WorkOrderStatus, WorkOrderPriority, ServiceIntervalType enums
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import Field
from schemas.common import (
    CamelBase,
    WorkOrderStatus,
    WorkOrderPriority,
    ServiceIntervalType,
)


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDER PART
# ─────────────────────────────────────────────────────────────────────────────

class WorkOrderPartCreate(CamelBase):
    """POST /maintenance/work-orders/{id}/parts"""
    part_name:   str           = Field(..., min_length=1, max_length=120)
    part_number: Optional[str] = Field(None, max_length=60)
    quantity:    int           = Field(..., ge=1)
    unit_cost:   float         = Field(..., ge=0)
    currency:    str           = Field(default="USD", max_length=3)


class WorkOrderPartResponse(CamelBase):
    """Embedded in WorkOrderResponse.parts[]"""
    id:            str
    work_order_id: str
    part_name:     str
    part_number:   Optional[str] = None
    quantity:      int
    unit_cost:     float
    total_cost:    float          # quantity × unit_cost — always server-computed
    currency:      str


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDER
# ─────────────────────────────────────────────────────────────────────────────

class WorkOrderCreate(CamelBase):
    """POST /maintenance/work-orders — ADMIN, MECHANIC"""
    truck_id:             str
    assigned_mechanic_id: str
    priority:             WorkOrderPriority = WorkOrderPriority.MEDIUM
    title:                str               = Field(..., min_length=1, max_length=200)
    description:          str               = Field(..., min_length=1)
    scheduled_date:       datetime
    odometer_at_service:  Optional[float]   = None
    estimated_cost:       Optional[float]   = Field(None, ge=0)
    currency:             str               = Field(default="USD", max_length=3)
    notes:                Optional[str]     = None


class WorkOrderUpdate(CamelBase):
    """PATCH /maintenance/work-orders/{id} — ADMIN, MECHANIC"""
    assigned_mechanic_id: Optional[str]              = None
    priority:             Optional[WorkOrderPriority] = None
    title:                Optional[str]               = Field(None, min_length=1, max_length=200)
    description:          Optional[str]               = None
    scheduled_date:       Optional[datetime]          = None
    odometer_at_service:  Optional[float]             = None
    estimated_cost:       Optional[float]             = Field(None, ge=0)
    notes:                Optional[str]               = None


class WorkOrderStatusUpdate(CamelBase):
    """
    PATCH /maintenance/work-orders/{id}/status — ADMIN, MECHANIC
    completed_date auto-set when status → completed, unless manually provided.
    """
    status:         WorkOrderStatus
    completed_date: Optional[datetime] = None
    notes:          Optional[str]      = None


class WorkOrderResponse(CamelBase):
    """
    GET /maintenance/work-orders      (list — parts=[])
    GET /maintenance/work-orders/{id} (detail — parts populated)
    """
    id:                str
    work_order_number: str
    truck_id:          str
    assigned_mechanic_id: str
    status:            WorkOrderStatus
    priority:          WorkOrderPriority
    title:             str
    description:       str
    scheduled_date:    datetime
    odometer_at_service:  Optional[float]           = None
    completed_date:       Optional[datetime]         = None
    estimated_cost:       Optional[float]            = None
    actual_cost:          Optional[float]            = None
    currency:          str
    notes:             Optional[str]                 = None
    parts:             list[WorkOrderPartResponse]   = []
    created_by:        str
    created_at:        datetime
    updated_at:        datetime
    # Resolved display fields — joined in service layer
    truck_plate:       Optional[str] = None
    mechanic_name:     Optional[str] = None
    created_by_name:   Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────

class ServiceScheduleCreate(CamelBase):
    """
    POST /maintenance/schedules — ADMIN, MECHANIC
    next_service_* are auto-calculated from interval + last service
    unless explicitly provided (manual override).
    """
    truck_id:              str
    service_type:          str = Field(..., min_length=1, max_length=100)
    interval_type:         ServiceIntervalType
    interval_value:        int  = Field(..., ge=1)
    last_service_date:     Optional[datetime] = None
    last_service_odometer: Optional[float]    = None
    next_service_date:     Optional[datetime] = None   # manual override
    next_service_odometer: Optional[float]    = None   # manual override
    reminder_days_before:  int                = Field(default=7, ge=0)
    is_active:             bool               = True


class ServiceScheduleUpdate(CamelBase):
    """
    PATCH /maintenance/schedules/{id} — ADMIN, MECHANIC
    Setting last_service_* triggers auto-recalc of next_service_*
    unless next_service_* are also explicitly provided.
    """
    service_type:          Optional[str]                 = None
    interval_type:         Optional[ServiceIntervalType] = None
    interval_value:        Optional[int]                 = Field(None, ge=1)
    last_service_date:     Optional[datetime]            = None
    last_service_odometer: Optional[float]               = None
    next_service_date:     Optional[datetime]            = None
    next_service_odometer: Optional[float]               = None
    reminder_days_before:  Optional[int]                 = Field(None, ge=0)
    is_active:             Optional[bool]                = None


class ServiceScheduleResponse(CamelBase):
    """GET /maintenance/schedules  |  GET /maintenance/schedules/{id}"""
    id:                    str
    truck_id:              str
    service_type:          str
    interval_type:         ServiceIntervalType
    interval_value:        int
    last_service_date:     Optional[datetime] = None
    last_service_odometer: Optional[float]    = None
    next_service_date:     Optional[datetime] = None
    next_service_odometer: Optional[float]    = None
    reminder_days_before:  int
    is_active:             bool
    created_by:            str
    created_at:            datetime
    updated_at:            datetime
    truck_plate:    Optional[str] = None
    days_until_due: Optional[int] = None   # negative = overdue