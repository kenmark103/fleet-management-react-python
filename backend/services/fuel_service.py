"""
services/fuel_service.py
Fleet Management System — Phase 6

Business logic for the Fuel & Costs module:
  - auto_total_cost()      computes litres × price_per_litre
  - resolve_fuel_log()     joins truck plate / driver name / trip number
  - resolve_expense()      joins truck plate / driver name / trip number
  - get_report_data()      single function returning all chart aggregations
  - generate_fuel_csv()    streams CSV for export endpoint
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import FuelLog, Expense, Truck, Driver, Trip, User
from schemas.fuel import (
    FuelReportResponse,
    FuelReportKpis,
    MonthlyFuelCost,
    MonthlyExpenseSummary,
    CategoryBreakdown,
    TruckConsumption,
)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def auto_total_cost(litres: float, price_per_litre: float) -> float:
    """Compute total fuel cost — called on create and update."""
    return round(litres * price_per_litre, 2)


async def resolve_fuel_log(log: FuelLog, db: AsyncSession) -> dict:
    """
    Return a dict of resolved display fields for a FuelLog ORM instance.
    Avoids N+1 by accepting preloaded relationships when available.
    """
    truck_plate: Optional[str] = None
    driver_name: Optional[str] = None
    trip_number: Optional[str] = None

    if log.truck_id:
        truck = await db.get(Truck, log.truck_id)
        if truck:
            truck_plate = truck.plate_number

    if log.driver_id:
        driver = await db.get(Driver, log.driver_id)
        if driver:
            driver_name = f"{driver.first_name} {driver.last_name}"

    if log.trip_id:
        trip = await db.get(Trip, log.trip_id)
        if trip:
            trip_number = trip.trip_number

    return {
        "truck_plate": truck_plate,
        "driver_name": driver_name,
        "trip_number": trip_number,
    }


async def resolve_expense(expense: Expense, db: AsyncSession) -> dict:
    """Return a dict of resolved display fields for an Expense ORM instance."""
    truck_plate: Optional[str]      = None
    driver_name: Optional[str]      = None
    trip_number: Optional[str]      = None
    created_by_name: Optional[str]  = None

    if expense.truck_id:
        truck = await db.get(Truck, expense.truck_id)
        if truck:
            truck_plate = truck.plate_number

    if expense.driver_id:
        driver = await db.get(Driver, expense.driver_id)
        if driver:
            driver_name = f"{driver.first_name} {driver.last_name}"

    if expense.trip_id:
        trip = await db.get(Trip, expense.trip_id)
        if trip:
            trip_number = trip.trip_number

    if expense.created_by:
        user = await db.get(User, expense.created_by)
        if user:
            created_by_name = f"{user.first_name} {user.last_name}"

    return {
        "truck_plate": truck_plate,
        "driver_name": driver_name,
        "trip_number": trip_number,
        "created_by_name": created_by_name,
    }


# ─────────────────────────────────────────────────────────────────────────────
# REPORT AGGREGATIONS
# ─────────────────────────────────────────────────────────────────────────────

async def get_report_data(
    db: AsyncSession,
    currency: str,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime]   = None,
) -> FuelReportResponse:
    """
    Single entry-point that computes all chart and KPI data for the Reports tab.
    All queries share the same date_from / date_to filters.
    """

    # ── date filter helpers ──────────────────────────────────────────────────
    def fuel_date_filter():
        filters = []
        if date_from:
            filters.append(FuelLog.logged_at >= date_from)
        if date_to:
            filters.append(FuelLog.logged_at <= date_to)
        return filters

    def expense_date_filter():
        filters = []
        if date_from:
            filters.append(Expense.expense_date >= date_from)
        if date_to:
            filters.append(Expense.expense_date <= date_to)
        return filters

    # ── KPIs ─────────────────────────────────────────────────────────────────
    total_fuel_cost_row = await db.execute(
        select(func.coalesce(func.sum(FuelLog.total_cost), 0.0))
        .where(*fuel_date_filter())
    )
    total_fuel_cost: float = total_fuel_cost_row.scalar_one()

    total_expenses_row = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0.0))
        .where(*expense_date_filter())
    )
    total_expenses: float = total_expenses_row.scalar_one()

    # Average cost per km — derived from trips that have both distance and fuel
    avg_cost_per_km: Optional[float] = None
    trip_distance_row = await db.execute(
        select(func.coalesce(func.sum(Trip.distance_km), 0.0))
        .where(Trip.distance_km.isnot(None))
    )
    total_distance: float = trip_distance_row.scalar_one()
    if total_distance and total_distance > 0:
        avg_cost_per_km = round(total_fuel_cost / total_distance, 4)

    kpis = FuelReportKpis(
        total_fuel_cost=round(total_fuel_cost, 2),
        total_expenses=round(total_expenses, 2),
        total_combined=round(total_fuel_cost + total_expenses, 2),
        avg_cost_per_km=avg_cost_per_km,
        currency=currency,
    )

    # ── Monthly fuel costs (line chart) ─────────────────────────────────────
    monthly_fuel_rows = await db.execute(
        select(
            func.to_char(FuelLog.logged_at, 'YYYY-MM').label('month'),
            func.sum(FuelLog.total_cost).label("total_cost"),
            func.sum(FuelLog.litres).label("total_litres"),
        )
        .where(*fuel_date_filter())
        .group_by("month")
        .order_by("month")
    )
    monthly_fuel_costs = [
        MonthlyFuelCost(
            month=row.month,
            total_cost=round(row.total_cost or 0, 2),
            total_litres=round(row.total_litres or 0, 2),
        )
        for row in monthly_fuel_rows
    ]

    # ── Monthly expense summary (bar chart) ──────────────────────────────────
    monthly_expense_rows = await db.execute(
        select(
            func.to_char(Expense.expense_date, 'YYYY-MM').label('month'),
            func.sum(Expense.amount).label("total_amount"),
        )
        .where(*expense_date_filter())
        .group_by("month")
        .order_by("month")
    )
    monthly_expenses = [
        MonthlyExpenseSummary(
            month=row.month,
            total_amount=round(row.total_amount or 0, 2),
        )
        for row in monthly_expense_rows
    ]

    # ── Category breakdown (donut chart) ─────────────────────────────────────
    category_rows = await db.execute(
        select(
            Expense.category.label("category"),
            func.sum(Expense.amount).label("total"),
        )
        .where(*expense_date_filter())
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
    )
    raw_categories = [(row.category, row.total or 0) for row in category_rows]
    grand_total = sum(t for _, t in raw_categories) or 1  # avoid div/0
    category_breakdown = [
        CategoryBreakdown(
            category=cat,
            total=round(total, 2),
            percentage=round((total / grand_total) * 100, 1),
        )
        for cat, total in raw_categories
    ]

    # ── Per-truck consumption (table) ─────────────────────────────────────────
    truck_rows = await db.execute(
        select(
            FuelLog.truck_id,
            func.sum(FuelLog.litres).label("total_litres"),
            func.sum(FuelLog.total_cost).label("total_fuel_cost"),
        )
        .where(*fuel_date_filter())
        .group_by(FuelLog.truck_id)
        .order_by(func.sum(FuelLog.total_cost).desc())
    )

    truck_consumption: list[TruckConsumption] = []
    for row in truck_rows:
        truck = await db.get(Truck, row.truck_id)
        if not truck:
            continue

        # Avg L/100km — use sum of completed trip distances for this truck
        dist_row = await db.execute(
            select(func.coalesce(func.sum(Trip.distance_km), 0.0))
            .where(
                Trip.assigned_truck_id == row.truck_id,
                Trip.distance_km.isnot(None),
                Trip.status == "completed",
            )
        )
        truck_distance: float = dist_row.scalar_one()
        avg_l = None
        if truck_distance and truck_distance > 0:
            avg_l = round((row.total_litres / truck_distance) * 100, 2)

        truck_consumption.append(
            TruckConsumption(
                truck_id=row.truck_id,
                truck_plate=truck.plate_number,
                total_litres=round(row.total_litres or 0, 2),
                total_fuel_cost=round(row.total_fuel_cost or 0, 2),
                avg_l_per_100km=avg_l,
            )
        )

    return FuelReportResponse(
        kpis=kpis,
        monthly_fuel_costs=monthly_fuel_costs,
        monthly_expenses=monthly_expenses,
        category_breakdown=category_breakdown,
        truck_consumption=truck_consumption,
        currency=currency,
        date_from=date_from,
        date_to=date_to,
    )


# ─────────────────────────────────────────────────────────────────────────────
# CSV EXPORT
# ─────────────────────────────────────────────────────────────────────────────

def generate_fuel_logs_csv(logs: list[FuelLog], resolved: list[dict]) -> str:
    """
    Generates a CSV string for the current filtered fuel-log view.
    `resolved` is a parallel list of display dicts from resolve_fuel_log().
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Date", "Truck", "Driver", "Trip",
        "Litres", "Price/Litre", "Total Cost", "Currency",
        "Odometer", "Station", "Station Location",
    ])

    for log, res in zip(logs, resolved):
        writer.writerow([
            log.logged_at.strftime("%Y-%m-%d %H:%M"),
            res.get("truck_plate", ""),
            res.get("driver_name", ""),
            res.get("trip_number", ""),
            log.litres,
            log.price_per_litre,
            log.total_cost,
            log.currency,
            log.odometer_at_fuel,
            log.station_name or "",
            log.station_location or "",
        ])

    return output.getvalue()