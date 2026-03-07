"""
schemas/drivers.py
Fleet Management System — Phase 4 (revised Phase 8)

Change from original:
  - DriverCreate no longer requires user_id.
    POST /drivers now creates the User account + Driver profile atomically.
    Caller supplies temp_password instead — the User row is an implementation
    detail of the endpoint, not the caller's responsibility.

Everything else (DriverUpdate, DriverResponse, documents, summary) is unchanged.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, field_validator

from schemas.common import CamelBase, DriverStatus, DriverDocumentType


# ─────────────────────────────────────────────────────────────────────────────
# DRIVERS
# ─────────────────────────────────────────────────────────────────────────────

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
    POST /drivers — ADMIN only.

    Creates a User (role=DRIVER) + Driver profile in a single atomic transaction.
    user_id is intentionally absent — the endpoint generates it internally.

    temp_password: admin sets it; driver should change on first login.
    """
    temp_password: str   # → tempPassword (camelCase on wire)

    @field_validator("temp_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class DriverUpdate(CamelBase):
    """
    PATCH /drivers/{id} — ADMIN only.

    All fields optional — only supplied fields are updated.
    Changing first_name / last_name / email here is mirrored to the
    linked User row by the router so accounts stay in sync.
    """
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
    """
    GET /drivers       — list item
    GET /drivers/{id}  — detail
    """
    id:               str
    user_id:          str
    # Computed fields — populated in the router
    current_truck_id: Optional[str] = None
    active_trip_id:   Optional[str] = None
    created_at:       datetime
    updated_at:       datetime


# ─────────────────────────────────────────────────────────────────────────────
# DRIVER DOCUMENTS
# ─────────────────────────────────────────────────────────────────────────────

class DriverDocumentCreate(CamelBase):
    """POST /drivers/{id}/documents — ADMIN only."""
    type:        DriverDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None


class DriverDocumentResponse(CamelBase):
    """GET /drivers/{id}/documents"""
    id:          str
    driver_id:   str
    type:        DriverDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None
    uploaded_at: datetime
    uploaded_by: str   # user_id


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

class DriverSummary(CamelBase):
    """GET /drivers/summary — aggregated counts for dashboard / header cards."""
    total_drivers:         int
    active_drivers:        int
    inactive_drivers:      int
    expiring_licenses_30d: int