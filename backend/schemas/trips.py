"""
schemas/trips.py
Fleet Management System — Phase 5

Changes:
  - Added TruckAvailability, TrailerAvailability, DriverAvailability,
    AvailabilityResponse for the GET /trips/availability endpoint.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from schemas.common import CamelBase, TripStatus


# ─────────────────────────────────────────────────────────────────────────────
# TRIP CRUD SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class TripBase(CamelBase):
    origin:              str
    destination:         str
    scheduled_departure: datetime
    scheduled_arrival:   datetime
    distance_km:         Optional[float] = None
    cargo_description:   Optional[str]   = None
    cargo_weight_tons:   Optional[float] = None
    notes:               Optional[str]   = None
    origin_lat:          Optional[float] = None
    origin_lng:          Optional[float] = None
    destination_lat:     Optional[float] = None
    destination_lng:     Optional[float] = None


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
    origin_lat:          Optional[float]      = None
    origin_lng:          Optional[float]      = None
    destination_lat:     Optional[float]      = None
    destination_lng:     Optional[float]      = None


class TripLocationPingResponse(CamelBase):
    id:          str
    trip_id:     str
    lat:         float
    lng:         float
    recorded_at: datetime
    recorded_by: str
    accuracy_m:  Optional[float] = None
    notes:       Optional[str]   = None


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
    # Denormalized display fields
    assigned_truck_plate:   Optional[str] = None
    assigned_trailer_plate: Optional[str] = None
    assigned_driver_name:   Optional[str] = None
    dispatched_by_name:     str = ""
    last_ping:              Optional[TripLocationPingResponse] = None


class TripStatusUpdateRequest(CamelBase):
    """PATCH /trips/{id}/status"""
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


# ─────────────────────────────────────────────────────────────────────────────
# AVAILABILITY SCHEMAS  — GET /trips/availability
# ─────────────────────────────────────────────────────────────────────────────

class TruckAvailability(CamelBase):
    """Single truck with availability status for the requested date range."""
    id:                   str
    plate_number:         str
    make:                 str
    model:                str
    year:                 int
    fuel_type:            str
    status:               str              # "active" | "in-progress"
    available:            bool
    # Set when available=False — lets the frontend show which trip blocks it
    conflict_trip_number: Optional[str] = None
    conflict_trip_id:     Optional[str] = None


class TrailerAvailability(CamelBase):
    """Single trailer with availability status for the requested date range."""
    id:                   str
    plate_number:         str
    type:                 str
    capacity_tons:        Optional[float] = None
    available:            bool
    conflict_trip_number: Optional[str]  = None
    conflict_trip_id:     Optional[str]  = None


class DriverAvailability(CamelBase):
    """Single driver with availability status for the requested date range."""
    id:                   str
    first_name:           str
    last_name:            str
    license_class:        str
    available:            bool
    conflict_trip_number: Optional[str] = None
    conflict_trip_id:     Optional[str] = None


class AvailabilityResponse(CamelBase):
    """
    Full availability snapshot returned by GET /trips/availability.

    When departure/arrival are None (no dates provided) all resources
    are returned with available=True — this is the initial TripForm load.
    """
    trucks:    list[TruckAvailability]
    trailers:  list[TrailerAvailability]
    drivers:   list[DriverAvailability]
    departure: Optional[datetime] = None
    arrival:   Optional[datetime] = None