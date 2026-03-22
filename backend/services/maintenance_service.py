"""
services/maintenance_service.py
Fleet Management System — Phase 7

Business logic:
  generate_wo_number()        → next WO-XXXXX
  resolve_work_order()        → truck plate + mechanic/creator names
  resolve_schedule()          → truck plate + days_until_due
  calculate_next_service()    → next date/odometer from interval
  recalculate_actual_cost()   → sums parts, writes back to WorkOrder.actual_cost
  mark_overdue_work_orders()  → flips pending/in-progress → overdue past scheduled_date
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import WorkOrder, WorkOrderPart, ServiceSchedule, Truck, User


# ─────────────────────────────────────────────────────────────────────────────
# WO NUMBER GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

async def generate_wo_number(db: AsyncSession) -> str:
    """Returns next available WO-XXXXX (5-digit zero-padded)."""
    result   = await db.execute(select(func.max(WorkOrder.work_order_number)))
    last: Optional[str] = result.scalar_one_or_none()

    last_num = 0
    if last:
        try:
            last_num = int(last.split("-")[1])
        except (IndexError, ValueError):
            last_num = 0

    return f"WO-{last_num + 1:05d}"


# ─────────────────────────────────────────────────────────────────────────────
# DISPLAY-FIELD RESOLVERS
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_work_order(wo: WorkOrder, db: AsyncSession) -> dict:
    """Returns resolved display fields for a WorkOrder ORM instance."""
    truck_plate: Optional[str]     = None
    mechanic_name: Optional[str]   = None
    created_by_name: Optional[str] = None

    if wo.truck_id:
        truck = await db.get(Truck, wo.truck_id)
        if truck:
            truck_plate = truck.plate_number

    if wo.assigned_mechanic_id:
        mechanic = await db.get(User, wo.assigned_mechanic_id)
        if mechanic:
            mechanic_name = f"{mechanic.first_name} {mechanic.last_name}"

    if wo.created_by:
        creator = await db.get(User, wo.created_by)
        if creator:
            created_by_name = f"{creator.first_name} {creator.last_name}"

    return {
        "truck_plate":     truck_plate,
        "mechanic_name":   mechanic_name,
        "created_by_name": created_by_name,
    }


async def resolve_schedule(schedule: ServiceSchedule, db: AsyncSession) -> dict:
    """Returns resolved display fields for a ServiceSchedule ORM instance."""
    truck_plate: Optional[str]    = None
    days_until_due: Optional[int] = None

    if schedule.truck_id:
        truck = await db.get(Truck, schedule.truck_id)
        if truck:
            truck_plate = truck.plate_number

    if schedule.next_service_date:
        delta = schedule.next_service_date.date() - datetime.utcnow().date()
        days_until_due = delta.days   # negative = overdue

    return {
        "truck_plate":    truck_plate,
        "days_until_due": days_until_due,
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEXT SERVICE CALCULATOR
# ─────────────────────────────────────────────────────────────────────────────

def calculate_next_service(
    interval_type: str,
    interval_value: int,
    last_service_date: Optional[datetime] = None,
    last_service_odometer: Optional[float] = None,
) -> tuple[Optional[datetime], Optional[float]]:
    """
    Returns (next_service_date, next_service_odometer).

    "days"   → next_date = base + N days
    "months" → next_date = base + N×30 days (avoids dateutil dependency)
    "km"     → next_odometer = last + N km
               next_date = rough projection at 200 km/day average
    """
    next_date: Optional[datetime]     = None
    next_odometer: Optional[float]    = None
    base = last_service_date or datetime.utcnow()

    if interval_type == "days":
        next_date = base + timedelta(days=interval_value)

    elif interval_type == "months":
        next_date = base + timedelta(days=interval_value * 30)

    elif interval_type == "km":
        if last_service_odometer is not None:
            next_odometer = last_service_odometer + interval_value
        # Rough date so calendar view has something to show
        next_date = base + timedelta(days=interval_value / 200)

    return next_date, next_odometer


# ─────────────────────────────────────────────────────────────────────────────
# ACTUAL COST RECALCULATOR
# ─────────────────────────────────────────────────────────────────────────────

async def recalculate_actual_cost(wo_id: str, db: AsyncSession) -> float:
    """
    Sums all WorkOrderPart.total_cost for this work order
    and writes the result back to WorkOrder.actual_cost.
    """
    result = await db.execute(
        select(func.coalesce(func.sum(WorkOrderPart.total_cost), 0.0))
        .where(WorkOrderPart.work_order_id == wo_id)
    )
    total: float = round(result.scalar_one(), 2)

    wo = await db.get(WorkOrder, wo_id)
    if wo:
        wo.actual_cost = total
        await db.commit()
        await db.refresh(wo)

    return total


# ─────────────────────────────────────────────────────────────────────────────
# OVERDUE MARKER
# ─────────────────────────────────────────────────────────────────────────────

async def mark_overdue_work_orders(db: AsyncSession) -> int:
    """
    Flips status → 'overdue' for any pending/in-progress WO
    whose scheduled_date is in the past.
    Called at the top of the list endpoint so data is always fresh.
    Returns the count of records updated.
    """
    result = await db.execute(
        update(WorkOrder)
        .where(
            WorkOrder.status.in_(["pending", "in-progress"]),
            WorkOrder.scheduled_date < datetime.now(timezone.utc),
        )
        .values(status="overdue")
        .execution_options(synchronize_session="fetch")
    )
    await db.commit()
    return result.rowcount