"""
schemas/fuel.py
Fleet Management System — Phase 6

Pydantic schemas for:
  - FuelLog  (logged by DRIVER or ADMIN)
  - Expense  (logged by FINANCE or ADMIN)
  - FuelReport  (aggregated data for charts — GET /fuel/reports)

All schemas extend CamelBase → snake_case fields serialise to camelCase
automatically for the frontend.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import Field, model_validator
from schemas.common import CamelBase, ExpenseCategory


# ─────────────────────────────────────────────────────────────────────────────
# FUEL LOG SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class FuelLogBase(CamelBase):
    truck_id:         str
    driver_id:        str
    trip_id:          Optional[str]   = None   # optional linkage
    litres:           float           = Field(..., gt=0)
    price_per_litre:  float           = Field(..., gt=0)
    currency:         str             = Field(default="USD", max_length=3)
    odometer_at_fuel: float           = Field(..., ge=0)
    station_name:     Optional[str]   = None
    station_location: Optional[str]   = None
    logged_at:        datetime


class FuelLogCreate(FuelLogBase):
    """
    POST /fuel/logs
    Roles: ADMIN, DRIVER
    total_cost is computed server-side — not accepted from client.
    """
    receipt_url: Optional[str] = None


class FuelLogUpdate(CamelBase):
    """
    PATCH /fuel/logs/{id}
    Roles: ADMIN, FINANCE
    All fields optional — only provided fields are updated.
    """
    trip_id:          Optional[str]   = None
    litres:           Optional[float] = Field(default=None, gt=0)
    price_per_litre:  Optional[float] = Field(default=None, gt=0)
    currency:         Optional[str]   = Field(default=None, max_length=3)
    odometer_at_fuel: Optional[float] = Field(default=None, ge=0)
    station_name:     Optional[str]   = None
    station_location: Optional[str]   = None
    receipt_url:      Optional[str]   = None
    logged_at:        Optional[datetime] = None


class FuelLogResponse(FuelLogBase):
    """
    GET /fuel/logs  |  GET /fuel/logs/{id}
    Includes server-computed total_cost and resolved display names.
    """
    id:           str
    total_cost:   float           # litres × price_per_litre, computed server-side
    receipt_url:  Optional[str]   = None
    created_at:   datetime
    updated_at:   datetime

    # Resolved display fields — joined in the service layer
    truck_plate:  Optional[str]   = None   # e.g. "KBZ 123A"
    driver_name:  Optional[str]   = None   # e.g. "John Doe"
    trip_number:  Optional[str]   = None   # e.g. "TRP-00042"


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class ExpenseBase(CamelBase):
    category:     ExpenseCategory
    amount:       float    = Field(..., gt=0)
    currency:     str      = Field(default="USD", max_length=3)
    description:  str      = Field(..., min_length=1, max_length=500)
    truck_id:     Optional[str]      = None
    driver_id:    Optional[str]      = None
    trip_id:      Optional[str]      = None
    expense_date: datetime


class ExpenseCreate(ExpenseBase):
    """
    POST /fuel/expenses
    Roles: ADMIN, FINANCE
    """
    receipt_url: Optional[str] = None


class ExpenseUpdate(CamelBase):
    """
    PATCH /fuel/expenses/{id}
    Roles: ADMIN, FINANCE
    """
    category:     Optional[ExpenseCategory] = None
    amount:       Optional[float]           = Field(default=None, gt=0)
    currency:     Optional[str]             = Field(default=None, max_length=3)
    description:  Optional[str]             = Field(default=None, min_length=1)
    truck_id:     Optional[str]             = None
    driver_id:    Optional[str]             = None
    trip_id:      Optional[str]             = None
    receipt_url:  Optional[str]             = None
    expense_date: Optional[datetime]        = None


class ExpenseResponse(ExpenseBase):
    """
    GET /fuel/expenses  |  GET /fuel/expenses/{id}
    Includes resolved display names.
    """
    id:          str
    receipt_url: Optional[str] = None
    created_by:  str
    created_at:  datetime
    updated_at:  datetime

    # Resolved display fields
    truck_plate:  Optional[str] = None
    driver_name:  Optional[str] = None
    trip_number:  Optional[str] = None
    created_by_name: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# REPORT SCHEMAS  — GET /fuel/reports
# ─────────────────────────────────────────────────────────────────────────────

class MonthlyFuelCost(CamelBase):
    """One data point for the line chart: total fuel spend per month."""
    month:      str    # "2026-01"
    total_cost: float
    total_litres: float


class MonthlyExpenseSummary(CamelBase):
    """One data point for the bar chart: total expenses per month."""
    month:       str   # "2026-01"
    total_amount: float


class CategoryBreakdown(CamelBase):
    """One slice of the donut chart: spend by expense category."""
    category: str    # ExpenseCategory value
    total:    float
    percentage: float


class TruckConsumption(CamelBase):
    """One row in the per-truck consumption table."""
    truck_id:        str
    truck_plate:     str
    total_litres:    float
    total_fuel_cost: float
    avg_l_per_100km: Optional[float] = None   # None when distance data unavailable


class FuelReportKpis(CamelBase):
    """Top KPI strip values."""
    total_fuel_cost:    float
    total_expenses:     float
    total_combined:     float
    avg_cost_per_km:    Optional[float] = None
    currency:           str


class FuelReportResponse(CamelBase):
    """
    Single response object returned by GET /fuel/reports.
    One request fetches all chart and KPI data.
    """
    kpis:               FuelReportKpis
    monthly_fuel_costs: list[MonthlyFuelCost]         # line chart
    monthly_expenses:   list[MonthlyExpenseSummary]   # bar chart
    category_breakdown: list[CategoryBreakdown]       # donut chart
    truck_consumption:  list[TruckConsumption]        # table
    currency:           str
    date_from:          Optional[datetime] = None
    date_to:            Optional[datetime] = None