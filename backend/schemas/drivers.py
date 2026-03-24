"""
schemas/drivers.py
Fleet Management System

DriverCreate change: removed temp_password, added user_id.
The User account is created separately via the invite flow.
POST /drivers now only creates the Driver profile row linked to an existing User.
Everything else (DriverUpdate, DriverResponse, documents, summary) is unchanged.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import field_validator

from schemas.common import CamelBase, DriverStatus, DriverDocumentType


class DriverBase(CamelBase):
    first_name:              str
    last_name:               str
    email:                   str
    phone:                   str
    status:                  DriverStatus
    license_number:          str
    license_class:           str
    license_expiry_date:     datetime
    hire_date:               datetime
    date_of_birth:           Optional[datetime] = None
    national_id:             Optional[str]      = None
    address:                 Optional[str]      = None
    emergency_contact_name:  Optional[str]      = None
    emergency_contact_phone: Optional[str]      = None
    avatar_url:              Optional[str]      = None
    notes:                   Optional[str]      = None


class DriverCreate(DriverBase):
    """
    POST /api/v1/drivers

    Links an existing User (role=DRIVER, already activated via invite) to a
    new Driver profile. Used by the self-service /drivers/setup page and by
    admins creating a profile for an existing user.

    user_id: ID of the already-existing User row to link.
    The router validates: user exists, role==DRIVER, no profile yet, unique license.
    """
    user_id: str   # → userId on the wire (CamelBase handles the conversion)

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class DriverUpdate(CamelBase):
    """PATCH /api/v1/drivers/{id} — all fields optional."""
    first_name:              Optional[str]          = None
    last_name:               Optional[str]          = None
    email:                   Optional[str]          = None
    phone:                   Optional[str]          = None
    status:                  Optional[DriverStatus] = None
    license_number:          Optional[str]          = None
    license_class:           Optional[str]          = None
    license_expiry_date:     Optional[datetime]     = None
    hire_date:               Optional[datetime]     = None
    date_of_birth:           Optional[datetime]     = None
    national_id:             Optional[str]          = None
    address:                 Optional[str]          = None
    emergency_contact_name:  Optional[str]          = None
    emergency_contact_phone: Optional[str]          = None
    avatar_url:              Optional[str]          = None
    notes:                   Optional[str]          = None


class DriverResponse(DriverBase):
    id:               str
    user_id:          str
    current_truck_id: Optional[str] = None
    active_trip_id:   Optional[str] = None
    created_at:       datetime
    updated_at:       datetime


class DriverDocumentCreate(CamelBase):
    type:        DriverDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None


class DriverDocumentResponse(CamelBase):
    id:          str
    driver_id:   str
    type:        DriverDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None
    uploaded_at: datetime
    uploaded_by: str


class DriverSummary(CamelBase):
    total_drivers:         int
    active_drivers:        int
    inactive_drivers:      int
    expiring_licenses_30d: int