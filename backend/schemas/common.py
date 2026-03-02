"""
schemas/common.py
Fleet Management System

Single source of truth for:
  - CamelBase config (alias_generator → camelCase for frontend)
  - All Pydantic enums (values match frontend TypeScript literals exactly)
  - Generic API response wrappers
"""

from __future__ import annotations
from typing import Generic, Optional, TypeVar
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


# ─────────────────────────────────────────────────────────────────────────────
# BASE CONFIG
# ─────────────────────────────────────────────────────────────────────────────

class CamelBase(BaseModel):
    """
    Base for every schema in the system.
    - alias_generator: serialises snake_case → camelCase automatically
    - populate_by_name: accepts both snake_case and camelCase on input
    - from_attributes: allows ORM model instances to be passed directly
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENUMS
# Values are the exact strings the frontend TypeScript types expect.
# ─────────────────────────────────────────────────────────────────────────────

from enum import Enum


class UserRole(str, Enum):
    ADMIN      = "ADMIN"
    DISPATCHER = "DISPATCHER"
    DRIVER     = "DRIVER"
    MECHANIC   = "MECHANIC"
    FINANCE    = "FINANCE"


class TruckStatus(str, Enum):
    ACTIVE      = "active"
    INACTIVE    = "inactive"
    IN_PROGRESS = "in-progress"   # serialised as "in-progress" (hyphen)


class TrailerStatus(str, Enum):
    ACTIVE   = "active"
    INACTIVE = "inactive"


class TrailerType(str, Enum):
    FLATBED      = "flatbed"
    REFRIGERATED = "refrigerated"
    TANKER       = "tanker"
    BOX          = "box"
    OTHER        = "other"


class FuelType(str, Enum):
    DIESEL   = "diesel"
    PETROL   = "petrol"
    ELECTRIC = "electric"
    HYBRID   = "hybrid"


class VehicleDocumentType(str, Enum):
    INSURANCE    = "insurance"
    REGISTRATION = "registration"
    INSPECTION   = "inspection"
    OTHER        = "other"


class DriverDocumentType(str, Enum):
    LICENSE     = "license"
    MEDICAL     = "medical"
    CONTRACT    = "contract"
    CERTIFICATE = "certificate"
    OTHER       = "other"


class DriverStatus(str, Enum):
    ACTIVE   = "active"
    INACTIVE = "inactive"


class TripStatus(str, Enum):
    PENDING   = "pending"
    EN_ROUTE  = "en-route"       # serialised as "en-route" (hyphen)
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WorkOrderStatus(str, Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in-progress"  # serialised as "in-progress" (hyphen)
    COMPLETED   = "completed"
    OVERDUE     = "overdue"


class WorkOrderPriority(str, Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


class ServiceIntervalType(str, Enum):
    KM     = "km"
    DAYS   = "days"
    MONTHS = "months"


class ExpenseCategory(str, Enum):
    FUEL        = "fuel"
    MAINTENANCE = "maintenance"
    TOLLS       = "tolls"
    TYRES       = "tyres"
    INSURANCE   = "insurance"
    LICENSING   = "licensing"
    SALARY      = "salary"
    OTHER       = "other"


# ─────────────────────────────────────────────────────────────────────────────
# API RESPONSE WRAPPERS  ←→  types/api.ts
# ─────────────────────────────────────────────────────────────────────────────

T = TypeVar("T")


class PaginationMeta(CamelBase):
    page:              int
    page_size:         int   # → pageSize
    total_items:       int   # → totalItems
    total_pages:       int   # → totalPages
    has_next_page:     bool  # → hasNextPage
    has_previous_page: bool  # → hasPreviousPage


class PaginatedResponse(CamelBase, Generic[T]):
    """
    Standard list envelope.
    Usage in endpoint: return PaginatedResponse[TruckResponse](data=..., meta=..., success=True)
    Wire shape:        { "data": [...], "meta": {...}, "success": true }
    """
    data:    list[T]
    meta:    PaginationMeta
    success: bool = True


class ApiResponse(CamelBase, Generic[T]):
    """
    Standard single-item envelope.
    Wire shape: { "data": {...}, "message": "...", "success": true }
    """
    data:    T
    message: Optional[str] = None
    success: bool = True