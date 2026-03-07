"""
schemas/settings.py
Fleet Management System — System Configuration

Single-row settings storage for organization preferences.
"""

from datetime import datetime
from typing import Optional, Literal

from schemas.common import CamelBase


class SystemSettingsBase(CamelBase):
    """Base settings — all fields optional for partial updates."""
    org_name: Optional[str] = None
    org_timezone: str = "UTC"
    date_format: Literal["ISO", "US", "EU"] = "ISO"

    currency: Literal["USD", "EUR", "GBP", "CAD", "AUD", "KES", "NGN"] = "USD"
    fuel_unit: Literal["gallons", "liters"] = "gallons"
    distance_unit: Literal["miles", "km"] = "miles"

    maintenance_warning_days: int = 7
    license_expiry_warning_days: int = 30
    document_expiry_warning_days: int = 14

    email_alerts_enabled: bool = True
    maintenance_alerts: bool = True
    trip_status_alerts: bool = True

    theme: Literal["light", "dark", "system"] = "system"
    default_language: str = "en"


class SystemSettingsResponse(SystemSettingsBase):
    """Full response including audit fields."""
    updated_at: datetime
    updated_by: Optional[str] = None


class SystemSettingsUpdate(CamelBase):
    """Partial update — all fields optional."""
    org_name: Optional[str] = None
    org_timezone: Optional[str] = None
    date_format: Optional[Literal["ISO", "US", "EU"]] = None

    currency: Optional[Literal["USD", "EUR", "GBP", "CAD", "AUD", "KES", "NGN"]] = None
    fuel_unit: Optional[Literal["gallons", "liters"]] = None
    distance_unit: Optional[Literal["miles", "km"]] = None

    maintenance_warning_days: Optional[int] = None
    license_expiry_warning_days: Optional[int] = None
    document_expiry_warning_days: Optional[int] = None

    email_alerts_enabled: Optional[bool] = None
    maintenance_alerts: Optional[bool] = None
    trip_status_alerts: Optional[bool] = None

    theme: Optional[Literal["light", "dark", "system"]] = None
    default_language: Optional[str] = None