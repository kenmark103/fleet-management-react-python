"""
schemas/fleet.py
Fleet Management System

Truck and Trailer Pydantic schemas.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from schemas.common import CamelBase, TruckStatus, TrailerStatus, TrailerType, FuelType, VehicleDocumentType


# ─────────────────────────────────────────────────────────────────────────────
# TRUCKS
# ─────────────────────────────────────────────────────────────────────────────

class TruckBase(CamelBase):
    plate_number:           str
    make:                   str
    model:                  str
    year:                   int
    status:                 TruckStatus
    odometer_km:            float
    fuel_type:              FuelType
    vin:                    Optional[str] = None
    color:                  Optional[str] = None
    insurance_expiry_date:  Optional[datetime] = None
    inspection_expiry_date: Optional[datetime] = None
    notes:                  Optional[str] = None


class TruckCreate(TruckBase):
    """POST /fleet/trucks — ADMIN only"""
    pass


class TruckUpdate(CamelBase):
    """PATCH /fleet/trucks/{id} — ADMIN only"""
    plate_number:           Optional[str]         = None
    make:                   Optional[str]         = None
    model:                  Optional[str]         = None
    year:                   Optional[int]         = None
    status:                 Optional[TruckStatus] = None
    odometer_km:            Optional[float]       = None
    fuel_type:              Optional[FuelType]    = None
    vin:                    Optional[str]         = None
    color:                  Optional[str]         = None
    insurance_expiry_date:  Optional[datetime]    = None
    inspection_expiry_date: Optional[datetime]    = None
    notes:                  Optional[str]         = None


class TruckResponse(TruckBase):
    """GET /fleet/trucks  |  GET /fleet/trucks/{id}"""
    id:                 str
    assigned_driver_id: Optional[str] = None
    current_trip_id:    Optional[str] = None
    created_at:         datetime
    updated_at:         datetime


class TruckDocumentResponse(CamelBase):
    """GET /fleet/trucks/{id}/documents"""
    id:          str
    truck_id:    str
    type:        VehicleDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None
    uploaded_at: datetime
    uploaded_by: str


class ServiceRecordResponse(CamelBase):
    """GET /fleet/trucks/{id}/service-history"""
    id:                  str
    truck_id:            str
    service_type:        str
    description:         str
    odometer_at_service: float
    cost:                float
    performed_by:        str
    work_order_id:       Optional[str] = None
    service_date:        datetime
    created_at:          datetime


# ─────────────────────────────────────────────────────────────────────────────
# TRAILERS
# ─────────────────────────────────────────────────────────────────────────────

class TrailerBase(CamelBase):
    plate_number:           str
    make:                   str
    model:                  str
    year:                   int
    status:                 TrailerStatus
    type:                   TrailerType
    capacity_tons:          Optional[float]   = None
    insurance_expiry_date:  Optional[datetime] = None
    inspection_expiry_date: Optional[datetime] = None
    notes:                  Optional[str]     = None


class TrailerCreate(TrailerBase):
    """POST /fleet/trailers — ADMIN only"""
    pass


class TrailerUpdate(CamelBase):
    """PATCH /fleet/trailers/{id} — ADMIN only"""
    plate_number:           Optional[str]           = None
    make:                   Optional[str]           = None
    model:                  Optional[str]           = None
    year:                   Optional[int]           = None
    status:                 Optional[TrailerStatus] = None
    type:                   Optional[TrailerType]   = None
    capacity_tons:          Optional[float]         = None
    insurance_expiry_date:  Optional[datetime]      = None
    inspection_expiry_date: Optional[datetime]      = None
    notes:                  Optional[str]           = None


class TrailerResponse(TrailerBase):
    """GET /fleet/trailers  |  GET /fleet/trailers/{id}"""
    id:               str
    assigned_trip_id: Optional[str] = None
    created_at:       datetime
    updated_at:       datetime


class TrailerDocumentResponse(CamelBase):
    id:          str
    trailer_id:  str
    type:        VehicleDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None
    uploaded_at: datetime
    uploaded_by: str

class FleetSummary(CamelBase):
    total_trucks:      int
    active_trucks:     int
    in_progress_trucks: int
    inactive_trucks:   int
    total_trailers:    int
    active_trailers:   int
    inactive_trailers: int