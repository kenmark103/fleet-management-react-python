"""
schemas/trips.py
Fleet Management System
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from schemas.common import CamelBase, TripStatus


class TripBase(CamelBase):
    origin:              str
    destination:         str
    scheduled_departure: datetime
    scheduled_arrival:   datetime
    distance_km:         Optional[float] = None
    cargo_description:   Optional[str]   = None
    cargo_weight_tons:   Optional[float] = None
    notes:               Optional[str]   = None


class TripCreate(TripBase):
    """POST /trips — ADMIN or DISPATCHER"""
    assigned_truck_id:   Optional[str] = None
    assigned_trailer_id: Optional[str] = None
    assigned_driver_id:  Optional[str] = None


class TripUpdate(CamelBase):
    """PATCH /trips/{id}"""
    origin:              Optional[str]        = None
    destination:         Optional[str]        = None
    scheduled_departure: Optional[datetime]   = None
    scheduled_arrival:   Optional[datetime]   = None
    status:              Optional[TripStatus] = None
    assigned_truck_id:   Optional[str]        = None
    assigned_trailer_id: Optional[str]        = None
    assigned_driver_id:  Optional[str]        = None
    actual_departure:    Optional[datetime]   = None
    actual_arrival:      Optional[datetime]   = None
    distance_km:         Optional[float]      = None
    cargo_description:   Optional[str]        = None
    cargo_weight_tons:   Optional[float]      = None
    notes:               Optional[str]        = None


class TripResponse(TripBase):
    """GET /trips  |  GET /trips/{id}"""
    id:                  str
    trip_number:         str
    status:              TripStatus
    actual_departure:    Optional[datetime] = None
    actual_arrival:      Optional[datetime] = None
    assigned_truck_id:   Optional[str]      = None
    assigned_trailer_id: Optional[str]      = None
    assigned_driver_id:  Optional[str]      = None
    dispatched_by:       str
    created_at:          datetime
    updated_at:          datetime


class TripStatusUpdateRequest(CamelBase):
    """PATCH /trips/{id}/status — DRIVER updating own trip status"""
    status:       TripStatus
    notes:        Optional[str]   = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class AssignmentResponse(CamelBase):
    id:          str
    trip_id:     str
    truck_id:    str
    driver_id:   str
    trailer_id:  Optional[str] = None
    assigned_at: datetime
    assigned_by: str