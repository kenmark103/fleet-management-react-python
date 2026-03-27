"""
schemas/reports.py
Fleet Management System — Phase 8
"""

from __future__ import annotations
from typing import Optional
from schemas.common import CamelBase


class TripsSummaryReport(CamelBase):
    total_trips:       int
    pending:           int
    en_route:          int    # → enRoute
    completed:         int
    cancelled:         int
    total_distance_km: float
    avg_duration_hours: float


class MaintenanceSummaryReport(CamelBase):
    total_work_orders: int
    pending:           int
    in_progress:       int   # → inProgress
    completed:         int
    overdue:           int
    total_cost:        float
    avg_cost:          float
    currency:          str


class DriverPerformanceRow(CamelBase):
    driver_id:          str
    driver_name:        str
    total_trips:        int
    completed_trips:    int
    cancelled_trips:    int
    total_distance_km:  float
    on_time_rate:       float   # 0.0–1.0, → onTimeRate


class DriverPerformanceReport(CamelBase):
    drivers: list[DriverPerformanceRow]
    date_from: Optional[str] = None
    date_to:   Optional[str] = None