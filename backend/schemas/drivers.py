"""
schemas/drivers.py
Fleet Management System
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import EmailStr, Field
from schemas.common import CamelBase, DriverStatus, DriverDocumentType


class DriverBase(CamelBase):
    user_id:                 str
    first_name:              str
    last_name:               str
    email:                   EmailStr
    phone:                   str
    status:                  DriverStatus
    license_number:          str
    license_class:           str
    license_expiry_date:     datetime
    date_of_birth:           Optional[datetime] = None
    national_id:             Optional[str]      = None
    address:                 Optional[str]      = None
    emergency_contact_name:  Optional[str]      = None
    emergency_contact_phone: Optional[str]      = None
    hire_date:               datetime
    avatar_url:              Optional[str]      = None
    notes:                   Optional[str]      = None


class DriverCreate(DriverBase):
    """POST /drivers — ADMIN only"""
    pass


class DriverUpdate(CamelBase):
    """PATCH /drivers/{id} — ADMIN only"""
    first_name:              Optional[str]          = None
    last_name:               Optional[str]          = None
    phone:                   Optional[str]          = None
    status:                  Optional[DriverStatus] = None
    license_number:          Optional[str]          = None
    license_class:           Optional[str]          = None
    license_expiry_date:     Optional[datetime]     = None
    address:                 Optional[str]          = None
    emergency_contact_name:  Optional[str]          = None
    emergency_contact_phone: Optional[str]          = None
    notes:                   Optional[str]          = None


class DriverResponse(DriverBase):
    """GET /drivers  |  GET /drivers/{id}"""
    id:         str
    created_at: datetime
    updated_at: datetime


class LicenseResponse(CamelBase):
    id:                str
    driver_id:         str
    license_number:    str
    # "class" is a Python reserved word — Field alias maps it correctly
    license_class:     str = Field(serialization_alias="class")
    issued_date:       datetime
    expiry_date:       datetime
    issuing_authority: Optional[str] = None
    file_url:          Optional[str] = None
    uploaded_at:       datetime


class DriverDocumentResponse(CamelBase):
    id:          str
    driver_id:   str
    type:        DriverDocumentType
    file_name:   str
    file_url:    str
    expiry_date: Optional[datetime] = None
    uploaded_at: datetime
    uploaded_by: str