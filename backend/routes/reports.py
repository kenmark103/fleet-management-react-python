"""
routers/reports.py
Fleet Management System — Phase 8

Aggregate report endpoints used exclusively by the Reports page.
Fuel data comes from the existing /fuel/reports endpoint — not duplicated here.

Endpoints:
  GET /reports/trips       — trip counts + totals for a date range
  GET /reports/maintenance — work-order counts + costs for a date range
  GET /reports/drivers     — per-driver performance for a date range
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_

from db.dbconfig import DB
from db.models import Trip, WorkOrder, Driver, User
from schemas.common import ApiResponse
from schemas.reports import (
    TripsSummaryReport,
    MaintenanceSummaryReport,
    DriverPerformanceReport,
    DriverPerformanceRow,
)
from auth.deps import require_roles

router = APIRouter(prefix="/reports", tags=["reports"])


def _date_filter(column, date_from: Optional[str], date_to: Optional[str]):
    """Returns a list of SQLAlchemy conditions for an inclusive date range."""
    clauses = []
    if date_from:
        clauses.append(column >= date_from)
    if date_to:
        clauses.append(column <= date_to)
    return clauses


@router.get(
    "/trips",
    response_model=ApiResponse[TripsSummaryReport],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "FINANCE"]))],
)
async def trips_summary(
    db:        DB,
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
):
    filters = _date_filter(Trip.scheduled_departure, date_from, date_to)
    base    = select(Trip).where(and_(*filters)) if filters else select(Trip)

    all_trips = (await db.execute(base)).scalars().all()

    total     = len(all_trips)
    pending   = sum(1 for t in all_trips if t.status == "pending")
    en_route  = sum(1 for t in all_trips if t.status == "en-route")
    completed = sum(1 for t in all_trips if t.status == "completed")
    cancelled = sum(1 for t in all_trips if t.status == "cancelled")
    total_km  = sum(t.distance_km or 0.0 for t in all_trips if t.status == "completed")

    # Avg duration for completed trips that have both actual times
    durations = [
        (t.actual_arrival - t.actual_departure).total_seconds() / 3600
        for t in all_trips
        if t.status == "completed" and t.actual_arrival and t.actual_departure
    ]
    avg_duration = sum(durations) / len(durations) if durations else 0.0

    return ApiResponse(data=TripsSummaryReport(
        total_trips=total,
        pending=pending,
        en_route=en_route,
        completed=completed,
        cancelled=cancelled,
        total_distance_km=round(total_km, 1),
        avg_duration_hours=round(avg_duration, 2),
    ))


@router.get(
    "/maintenance",
    response_model=ApiResponse[MaintenanceSummaryReport],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "FINANCE", "MECHANIC"]))],
)
async def maintenance_summary(
    db:        DB,
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
):
    filters = _date_filter(WorkOrder.scheduled_date, date_from, date_to)
    base    = select(WorkOrder).where(and_(*filters)) if filters else select(WorkOrder)

    orders = (await db.execute(base)).scalars().all()

    total       = len(orders)
    pending     = sum(1 for o in orders if o.status == "pending")
    in_progress = sum(1 for o in orders if o.status == "in-progress")
    completed   = sum(1 for o in orders if o.status == "completed")
    overdue     = sum(1 for o in orders if o.status == "overdue")
    total_cost  = sum(o.actual_cost or o.estimated_cost or 0.0 for o in orders)
    avg_cost    = total_cost / total if total else 0.0
    currency    = orders[0].currency if orders else "USD"

    return ApiResponse(data=MaintenanceSummaryReport(
        total_work_orders=total,
        pending=pending,
        in_progress=in_progress,
        completed=completed,
        overdue=overdue,
        total_cost=round(total_cost, 2),
        avg_cost=round(avg_cost, 2),
        currency=currency,
    ))


@router.get(
    "/drivers",
    response_model=ApiResponse[DriverPerformanceReport],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER", "FINANCE"]))],
)
async def driver_performance(
    db:        DB,
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
):
    filters   = _date_filter(Trip.scheduled_departure, date_from, date_to)
    base      = select(Trip).where(and_(*filters)) if filters else select(Trip)
    all_trips = (await db.execute(base)).scalars().all()

    # Group by driver
    from collections import defaultdict
    driver_trips: dict[str, list] = defaultdict(list)
    for t in all_trips:
        if t.assigned_driver_id:
            driver_trips[t.assigned_driver_id].append(t)

    rows: list[DriverPerformanceRow] = []
    for driver_id, trips in driver_trips.items():
        driver = await db.get(Driver, driver_id)
        if not driver:
            continue

        total_t     = len(trips)
        completed_t = sum(1 for t in trips if t.status == "completed")
        cancelled_t = sum(1 for t in trips if t.status == "cancelled")
        total_km    = sum(t.distance_km or 0.0 for t in trips if t.status == "completed")

        # On-time: actual_arrival <= scheduled_arrival
        finished = [t for t in trips if t.status == "completed" and t.actual_arrival]
        on_time  = sum(
            1 for t in finished
            if t.actual_arrival and t.scheduled_arrival and t.actual_arrival <= t.scheduled_arrival
        )
        on_time_rate = on_time / len(finished) if finished else 0.0

        rows.append(DriverPerformanceRow(
            driver_id=driver_id,
            driver_name=f"{driver.first_name} {driver.last_name}",
            total_trips=total_t,
            completed_trips=completed_t,
            cancelled_trips=cancelled_t,
            total_distance_km=round(total_km, 1),
            on_time_rate=round(on_time_rate, 3),
        ))

    rows.sort(key=lambda r: r.completed_trips, reverse=True)

    return ApiResponse(data=DriverPerformanceReport(
        drivers=rows,
        date_from=date_from,
        date_to=date_to,
    ))