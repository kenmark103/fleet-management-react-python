"""
schemas/incidents.py
Fleet Management System — Phase 8
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from schemas.common import CamelBase, IncidentType, IncidentSeverity, IncidentStatus


class IncidentAttachmentResponse(CamelBase):
    id:          str
    incident_id: str
    file_name:   str
    file_url:    str
    file_type:   Optional[str]  = None
    uploaded_by: str
    uploaded_at: datetime


class IncidentAttachmentCreate(CamelBase):
    file_name: str
    file_url:  str
    file_type: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# INCIDENT CRUD SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class IncidentBase(CamelBase):
    title:         str
    description:   str
    type:          IncidentType
    severity:      IncidentSeverity
    incident_date: datetime
    location:      Optional[str]   = None
    location_lat:  Optional[float] = None
    location_lng:  Optional[float] = None
    driver_id:     Optional[str]   = None
    truck_id:      Optional[str]   = None
    trailer_id:    Optional[str]   = None
    trip_id:       Optional[str]   = None


class IncidentCreate(IncidentBase):
    """POST /api/v1/incidents"""
    pass


class IncidentUpdate(CamelBase):
    """PATCH /api/v1/incidents/{id} — all fields optional"""
    title:            Optional[str]              = None
    description:      Optional[str]              = None
    type:             Optional[IncidentType]     = None
    severity:         Optional[IncidentSeverity] = None
    incident_date:    Optional[datetime]         = None
    location:         Optional[str]              = None
    location_lat:     Optional[float]            = None
    location_lng:     Optional[float]            = None
    driver_id:        Optional[str]              = None
    truck_id:         Optional[str]              = None
    trailer_id:       Optional[str]              = None
    trip_id:          Optional[str]              = None
    resolution_notes: Optional[str]              = None


class IncidentStatusUpdate(CamelBase):
    """PATCH /api/v1/incidents/{id}/status"""
    status:           IncidentStatus
    resolution_notes: Optional[str] = None


class IncidentResponse(IncidentBase):
    id:               str
    incident_number:  str
    status:           IncidentStatus
    reported_by:      str
    resolution_notes: Optional[str]      = None
    resolved_at:      Optional[datetime] = None
    resolved_by:      Optional[str]      = None
    created_at:       datetime
    updated_at:       datetime
    attachments:      List[IncidentAttachmentResponse] = []
    # Denormalised display fields
    reporter_name:    str            = ""
    driver_name:      Optional[str]  = None
    truck_plate:      Optional[str]  = None
    trip_number:      Optional[str]  = None


class IncidentSummary(CamelBase):
    total:       int
    open:        int
    under_review: int   # → underReview
    resolved:    int
    closed:      int
    critical:    int    # total critical-severity incidents