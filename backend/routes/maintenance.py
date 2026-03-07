"""
routers/maintenance.py
Fleet Management System — Phase 7

Auth pattern matches deps.py exactly:
  require_roles([...]) is a factory → always used as Depends(require_roles([...]))
  CurrentUser injected directly where the handler needs the user object.

Endpoints:
  Work Orders
    GET    /maintenance/work-orders
    POST   /maintenance/work-orders
    GET    /maintenance/work-orders/{wo_id}
    PATCH  /maintenance/work-orders/{wo_id}
    PATCH  /maintenance/work-orders/{wo_id}/status
    DELETE /maintenance/work-orders/{wo_id}
    POST   /maintenance/work-orders/{wo_id}/parts
    DELETE /maintenance/work-orders/{wo_id}/parts/{part_id}

  Service Schedules
    GET    /maintenance/schedules
    POST   /maintenance/schedules
    GET    /maintenance/schedules/{schedule_id}
    PATCH  /maintenance/schedules/{schedule_id}
    DELETE /maintenance/schedules/{schedule_id}
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from db.dbconfig import DB
from db.models import WorkOrder, WorkOrderPart, ServiceSchedule, User
from schemas.common import PaginatedResponse, PaginationMeta, ApiResponse
from schemas.maintenance import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderStatusUpdate,
    WorkOrderResponse,
    WorkOrderPartCreate,
    WorkOrderPartResponse,
    ServiceScheduleCreate,
    ServiceScheduleUpdate,
    ServiceScheduleResponse,
)
from services.maintenance_service import (
    generate_wo_number,
    resolve_work_order,
    resolve_schedule,
    calculate_next_service,
    recalculate_actual_cost,
    mark_overdue_work_orders,
)
from services.notification_service import notify_work_order_assigned
from auth.deps import get_current_user, require_roles

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

CurrentUser = Annotated[User, Depends(get_current_user)]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _meta(page: int, page_size: int, total: int) -> PaginationMeta:
    total_pages = max(1, -(-total // page_size))
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=total_pages,
        has_next_page=page < total_pages,
        has_previous_page=page > 1,
    )


async def _get_wo(wo_id: str, db: DB) -> WorkOrder:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found.")
    return wo


async def _get_schedule(schedule_id: str, db: DB) -> ServiceSchedule:
    s = await db.get(ServiceSchedule, schedule_id)
    if not s:
        raise HTTPException(status_code=404, detail="Service schedule not found.")
    return s


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/work-orders",
    response_model=PaginatedResponse[WorkOrderResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "MECHANIC"]))],
)
async def list_work_orders(
    db:          DB,
    page:        int            = Query(1, ge=1),
    page_size:   int            = Query(20, ge=1, le=100),
    status_:     Optional[str]  = Query(None, alias="status"),
    priority:    Optional[str]  = Query(None),
    truck_id:    Optional[str]  = Query(None),
    mechanic_id: Optional[str]  = Query(None),
    search:      Optional[str]  = Query(None),
):
    # Flip overdue statuses before responding — keeps list accurate
    await mark_overdue_work_orders(db)

    filters = []
    if status_:
        filters.append(WorkOrder.status == status_)
    if priority:
        filters.append(WorkOrder.priority == priority)
    if truck_id:
        filters.append(WorkOrder.truck_id == truck_id)
    if mechanic_id:
        filters.append(WorkOrder.assigned_mechanic_id == mechanic_id)
    if search:
        filters.append(WorkOrder.title.ilike(f"%{search}%"))

    base_q = select(WorkOrder).where(*filters)
    total  = len((await db.execute(base_q)).scalars().all())

    offset = (page - 1) * page_size
    rows   = (await db.execute(
        base_q.order_by(WorkOrder.scheduled_date.asc())
              .offset(offset).limit(page_size)
    )).scalars().all()

    data = []
    for wo in rows:
        resolved = await resolve_work_order(wo, db)
        # List endpoint returns parts=[] for performance; detail has full parts
        data.append(WorkOrderResponse.model_validate({**wo.__dict__, "parts": [], **resolved}))

    return PaginatedResponse[WorkOrderResponse](
        data=data, meta=_meta(page, page_size, total), success=True
    )


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — CREATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/work-orders",
    response_model=ApiResponse[WorkOrderResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def create_work_order(
    payload:      WorkOrderCreate,
    db:           DB,
    current_user: CurrentUser,
):
    wo_number = await generate_wo_number(db)

    wo = WorkOrder(
        id=str(uuid.uuid4()),
        work_order_number=wo_number,
        status="pending",
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(wo)
    await notify_work_order_assigned(db, wo)
    await db.commit()
    await db.refresh(wo)

    resolved = await resolve_work_order(wo, db)
    return ApiResponse[WorkOrderResponse](
        data=WorkOrderResponse.model_validate({**wo.__dict__, "parts": [], **resolved}),
        message="Work order created.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — DETAIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/work-orders/{wo_id}",
    response_model=ApiResponse[WorkOrderResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "MECHANIC"]))],
)
async def get_work_order(wo_id: str, db: DB):
    wo       = await _get_wo(wo_id, db)
    resolved = await resolve_work_order(wo, db)
    return ApiResponse[WorkOrderResponse](
        data=WorkOrderResponse.model_validate({**wo.__dict__, **resolved})
    )


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/work-orders/{wo_id}",
    response_model=ApiResponse[WorkOrderResponse],
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def update_work_order(wo_id: str, payload: WorkOrderUpdate, db: DB):
    wo = await _get_wo(wo_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wo, field, value)

    await db.commit()
    await db.refresh(wo)

    resolved = await resolve_work_order(wo, db)
    return ApiResponse[WorkOrderResponse](
        data=WorkOrderResponse.model_validate({**wo.__dict__, **resolved}),
        message="Work order updated.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — STATUS UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/work-orders/{wo_id}/status",
    response_model=ApiResponse[WorkOrderResponse],
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def update_work_order_status(
    wo_id:   str,
    payload: WorkOrderStatusUpdate,
    db:      DB,
):
    wo = await _get_wo(wo_id, db)

    wo.status = payload.status.value

    # Auto-set completed_date when transitioning → completed
    if payload.status.value == "completed":
        wo.completed_date = payload.completed_date or datetime.utcnow()

    # Append timestamped note if provided
    if payload.notes:
        existing = wo.notes or ""
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        wo.notes  = f"{existing}\n[{timestamp}] {payload.notes}".strip()

    await db.commit()
    await db.refresh(wo)

    resolved = await resolve_work_order(wo, db)
    return ApiResponse[WorkOrderResponse](
        data=WorkOrderResponse.model_validate({**wo.__dict__, **resolved}),
        message=f"Status updated to '{payload.status.value}'.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/work-orders/{wo_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_work_order(wo_id: str, db: DB):
    wo = await _get_wo(wo_id, db)
    await db.delete(wo)
    await db.commit()
    return ApiResponse[dict](data={}, message="Work order deleted.")


# ─────────────────────────────────────────────────────────────────────────────
# PARTS — ADD
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/work-orders/{wo_id}/parts",
    response_model=ApiResponse[WorkOrderPartResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def add_part(wo_id: str, payload: WorkOrderPartCreate, db: DB):
    await _get_wo(wo_id, db)   # 404 guard

    total_cost = round(payload.quantity * payload.unit_cost, 2)
    part = WorkOrderPart(
        id=str(uuid.uuid4()),
        work_order_id=wo_id,
        total_cost=total_cost,
        **payload.model_dump(),
    )
    db.add(part)
    await db.commit()
    await db.refresh(part)

    # Recalculate actual_cost on the parent WO
    await recalculate_actual_cost(wo_id, db)

    return ApiResponse[WorkOrderPartResponse](
        data=WorkOrderPartResponse.model_validate(part),
        message="Part added.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# PARTS — DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/work-orders/{wo_id}/parts/{part_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def delete_part(wo_id: str, part_id: str, db: DB):
    part = await db.get(WorkOrderPart, part_id)
    if not part or part.work_order_id != wo_id:
        raise HTTPException(status_code=404, detail="Part not found.")

    await db.delete(part)
    await db.commit()

    # Recalculate actual_cost after removal
    await recalculate_actual_cost(wo_id, db)

    return ApiResponse[dict](data={}, message="Part removed.")


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULES — LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/schedules",
    response_model=PaginatedResponse[ServiceScheduleResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "MECHANIC"]))],
)
async def list_schedules(
    db:        DB,
    page:      int            = Query(1, ge=1),
    page_size: int            = Query(20, ge=1, le=100),
    truck_id:  Optional[str]  = Query(None),
    is_active: Optional[bool] = Query(None),
    due_soon:  Optional[bool] = Query(None),   # True → due within 30 days
):
    filters = []
    if truck_id:
        filters.append(ServiceSchedule.truck_id == truck_id)
    if is_active is not None:
        filters.append(ServiceSchedule.is_active == is_active)
    if due_soon:
        cutoff = datetime.utcnow() + timedelta(days=30)
        filters.append(ServiceSchedule.next_service_date <= cutoff)
        filters.append(ServiceSchedule.is_active == True)

    base_q = select(ServiceSchedule).where(*filters)
    total  = len((await db.execute(base_q)).scalars().all())

    offset = (page - 1) * page_size
    rows   = (await db.execute(
        base_q.order_by(ServiceSchedule.next_service_date.asc())
              .offset(offset).limit(page_size)
    )).scalars().all()

    data = []
    for s in rows:
        resolved = await resolve_schedule(s, db)
        data.append(ServiceScheduleResponse.model_validate({**s.__dict__, **resolved}))

    return PaginatedResponse[ServiceScheduleResponse](
        data=data, meta=_meta(page, page_size, total), success=True
    )


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULES — CREATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/schedules",
    response_model=ApiResponse[ServiceScheduleResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def create_schedule(
    payload:      ServiceScheduleCreate,
    db:           DB,
    current_user: CurrentUser,
):
    data = payload.model_dump()

    # Auto-calculate next service if not manually provided
    if not data.get("next_service_date") and not data.get("next_service_odometer"):
        next_date, next_odometer = calculate_next_service(
            interval_type=data["interval_type"],
            interval_value=data["interval_value"],
            last_service_date=data.get("last_service_date"),
            last_service_odometer=data.get("last_service_odometer"),
        )
        data["next_service_date"]     = next_date
        data["next_service_odometer"] = next_odometer

    schedule = ServiceSchedule(
        id=str(uuid.uuid4()),
        created_by=current_user.id,
        **data,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    resolved = await resolve_schedule(schedule, db)
    return ApiResponse[ServiceScheduleResponse](
        data=ServiceScheduleResponse.model_validate({**schedule.__dict__, **resolved}),
        message="Service schedule created.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULES — DETAIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/schedules/{schedule_id}",
    response_model=ApiResponse[ServiceScheduleResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "MECHANIC"]))],
)
async def get_schedule(schedule_id: str, db: DB):
    s        = await _get_schedule(schedule_id, db)
    resolved = await resolve_schedule(s, db)
    return ApiResponse[ServiceScheduleResponse](
        data=ServiceScheduleResponse.model_validate({**s.__dict__, **resolved})
    )


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULES — UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/schedules/{schedule_id}",
    response_model=ApiResponse[ServiceScheduleResponse],
    dependencies=[Depends(require_roles(["ADMIN", "MECHANIC"]))],
)
async def update_schedule(schedule_id: str, payload: ServiceScheduleUpdate, db: DB):
    s           = await _get_schedule(schedule_id, db)
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(s, field, value)

    # Re-calculate next service when last_service changed
    # but next_service was NOT explicitly provided in this update
    if (
        ("last_service_date" in update_data or "last_service_odometer" in update_data)
        and "next_service_date"     not in update_data
        and "next_service_odometer" not in update_data
    ):
        next_date, next_odometer = calculate_next_service(
            interval_type=s.interval_type,
            interval_value=s.interval_value,
            last_service_date=s.last_service_date,
            last_service_odometer=s.last_service_odometer,
        )
        s.next_service_date     = next_date
        s.next_service_odometer = next_odometer

    await db.commit()
    await db.refresh(s)

    resolved = await resolve_schedule(s, db)
    return ApiResponse[ServiceScheduleResponse](
        data=ServiceScheduleResponse.model_validate({**s.__dict__, **resolved}),
        message="Service schedule updated.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULES — DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/schedules/{schedule_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_schedule(schedule_id: str, db: DB):
    s = await _get_schedule(schedule_id, db)
    await db.delete(s)
    await db.commit()
    return ApiResponse[dict](data={}, message="Service schedule deleted.")