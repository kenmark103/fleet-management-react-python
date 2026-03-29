"""
routers/incidents.py
Fleet Management System — Phase 8

Endpoints:
  GET    /incidents/summary
  GET    /incidents
  POST   /incidents
  GET    /incidents/{id}
  PATCH  /incidents/{id}
  PATCH  /incidents/{id}/status
  DELETE /incidents/{id}
  POST   /incidents/{id}/attachments
  DELETE /incidents/{id}/attachments/{att_id}

Role matrix:
  Create/Update:  ADMIN, DISPATCHER, DRIVER, MECHANIC (any authenticated user can report)
  Status update:  ADMIN, DISPATCHER
  Delete:         ADMIN only
  Read:           all roles
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc, or_

from db.dbconfig import DB
from db.models import Incident, IncidentAttachment, Driver, Truck, Trip, User
from schemas.common import (
    PaginatedResponse, PaginationMeta, ApiResponse,
    IncidentStatus,
)
from schemas.incidents import (
    IncidentCreate, IncidentUpdate, IncidentStatusUpdate,
    IncidentResponse, IncidentAttachmentCreate, IncidentAttachmentResponse,
    IncidentSummary,
)
from auth.deps import get_current_user, require_roles
from services.notification_service import notify_incident_reported

router = APIRouter(prefix="/incidents", tags=["incidents"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

async def _get_incident_or_404(incident_id: str, db: DB) -> Incident:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


async def generate_incident_number(db: DB) -> str:
    result = await db.execute(
        select(Incident.incident_number).order_by(desc(Incident.created_at)).limit(1)
    )
    last = result.scalar_one_or_none()
    if not last or not last.startswith("INC-"):
        return "INC-00001"
    try:
        num = int(last.split("-")[1])
        return f"INC-{num + 1:05d}"
    except (IndexError, ValueError):
        return "INC-00001"


async def resolve_incident_response(db: DB, incident: Incident) -> IncidentResponse:
    """
    Build a full IncidentResponse including denormalised display fields.

    ⚠️  Do NOT call IncidentResponse.model_validate(incident) directly —
    Pydantic's from_attributes mode accesses incident.attachments (a SQLAlchemy
    relationship) which raises MissingGreenlet in async context and causes a 500.
    Instead, extract scalar columns explicitly and pass the fetched related data.
    """
    reporter_name = ""
    driver_name   = None
    truck_plate   = None
    trip_number   = None

    reporter = await db.get(User, incident.reported_by)
    if reporter:
        reporter_name = f"{reporter.first_name} {reporter.last_name}"

    if incident.driver_id:
        d = await db.get(Driver, incident.driver_id)
        if d:
            driver_name = f"{d.first_name} {d.last_name}"

    if incident.truck_id:
        t = await db.get(Truck, incident.truck_id)
        if t:
            truck_plate = t.plate_number

    if incident.trip_id:
        tr = await db.get(Trip, incident.trip_id)
        if tr:
            trip_number = tr.trip_number

    # Load attachments explicitly — never through the relationship attribute
    att_result = await db.execute(
        select(IncidentAttachment)
        .where(IncidentAttachment.incident_id == incident.id)
        .order_by(IncidentAttachment.uploaded_at.asc())
    )
    attachments = [
        IncidentAttachmentResponse.model_validate(a)
        for a in att_result.scalars().all()
    ]

    # ✅ FIX: build response from scalar values only — never model_validate(incident)
    # because that triggers lazy relationship access in async SQLAlchemy.
    return IncidentResponse(
        id=incident.id,
        incident_number=incident.incident_number,
        title=incident.title,
        description=incident.description,
        type=incident.type,
        severity=incident.severity,
        status=incident.status,
        incident_date=incident.incident_date,
        location=incident.location,
        location_lat=incident.location_lat,
        location_lng=incident.location_lng,
        driver_id=incident.driver_id,
        truck_id=incident.truck_id,
        trailer_id=incident.trailer_id,
        trip_id=incident.trip_id,
        reported_by=incident.reported_by,
        resolution_notes=incident.resolution_notes,
        resolved_at=incident.resolved_at,
        resolved_by=incident.resolved_by,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        # Denormalised
        reporter_name=reporter_name,
        driver_name=driver_name,
        truck_plate=truck_plate,
        trip_number=trip_number,
        attachments=attachments,
    )


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY — must be registered BEFORE /{id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/summary",
    response_model=ApiResponse[IncidentSummary],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER"]))],
)
async def get_incident_summary(db: DB):
    total_q    = await db.execute(select(func.count(Incident.id)))
    open_q     = await db.execute(select(func.count(Incident.id)).where(Incident.status == "open"))
    review_q   = await db.execute(select(func.count(Incident.id)).where(Incident.status == "under_review"))
    resolved_q = await db.execute(select(func.count(Incident.id)).where(Incident.status == "resolved"))
    closed_q   = await db.execute(select(func.count(Incident.id)).where(Incident.status == "closed"))
    critical_q = await db.execute(select(func.count(Incident.id)).where(Incident.severity == "critical"))

    return ApiResponse(data=IncidentSummary(
        total=total_q.scalar_one(),
        open=open_q.scalar_one(),
        under_review=review_q.scalar_one(),
        resolved=resolved_q.scalar_one(),
        closed=closed_q.scalar_one(),
        critical=critical_q.scalar_one(),
    ))


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[IncidentResponse])
async def list_incidents(
    db:           DB,
    current_user: User       = Depends(get_current_user),
    page:         int        = Query(1, ge=1),
    page_size:    int        = Query(20, ge=1, le=100),
    status:       Optional[str] = Query(None),
    severity:     Optional[str] = Query(None),
    type:         Optional[str] = Query(None),
    driver_id:    Optional[str] = Query(None),
    truck_id:     Optional[str] = Query(None),
    trip_id:      Optional[str] = Query(None),
    search:       Optional[str] = Query(None),
    date_from:    Optional[str] = Query(None),
    date_to:      Optional[str] = Query(None),
):
    q = select(Incident)

    # DRIVER can only see incidents they reported or are linked to
    if current_user.role == "DRIVER":
        driver_profile = (
            await db.execute(select(Driver).where(Driver.user_id == current_user.id))
        ).scalar_one_or_none()
        own_driver_id = driver_profile.id if driver_profile else None
        q = q.where(
            or_(
                Incident.reported_by == current_user.id,
                Incident.driver_id == own_driver_id,
            )
        )

    if status:
        q = q.where(Incident.status == status)
    if severity:
        q = q.where(Incident.severity == severity)
    if type:
        q = q.where(Incident.type == type)
    if driver_id:
        q = q.where(Incident.driver_id == driver_id)
    if truck_id:
        q = q.where(Incident.truck_id == truck_id)
    if trip_id:
        q = q.where(Incident.trip_id == trip_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            or_(
                Incident.title.ilike(term),
                Incident.incident_number.ilike(term),
                Incident.description.ilike(term),
                Incident.location.ilike(term),
            )
        )
    if date_from:
        q = q.where(Incident.incident_date >= date_from)
    if date_to:
        q = q.where(Incident.incident_date <= date_to)

    total       = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    offset      = (page - 1) * page_size
    result      = await db.execute(
        q.offset(offset).limit(page_size).order_by(desc(Incident.incident_date))
    )
    incidents   = result.scalars().all()
    total_pages = max(1, -(-total // page_size))

    data = [await resolve_incident_response(db, i) for i in incidents]

    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next_page=page < total_pages,
            has_previous_page=page > 1,
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=ApiResponse[IncidentResponse], status_code=status.HTTP_201_CREATED)
async def create_incident(
    body:         IncidentCreate,
    db:           DB,
    current_user: User = Depends(get_current_user),
):
    incident_number = await generate_incident_number(db)
    incident = Incident(
        **body.model_dump(),
        incident_number=incident_number,
        reported_by=current_user.id,
    )
    db.add(incident)
    await db.flush()  # get incident.id before notifications

    # Notify admins/dispatchers + linked driver — same transaction as the insert
    await notify_incident_reported(db, incident, reporter_id=current_user.id)

    await db.commit()
    await db.refresh(incident)

    return ApiResponse(
        data=await resolve_incident_response(db, incident),
        message=f"Incident {incident_number} reported",
    )


# ─────────────────────────────────────────────────────────────────────────────
# DETAIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{incident_id}", response_model=ApiResponse[IncidentResponse])
async def get_incident(incident_id: str, db: DB):
    incident = await _get_incident_or_404(incident_id, db)
    return ApiResponse(data=await resolve_incident_response(db, incident))


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/{incident_id}",
    response_model=ApiResponse[IncidentResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER"]))],
)
async def update_incident(incident_id: str, body: IncidentUpdate, db: DB):
    incident = await _get_incident_or_404(incident_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)
    await db.commit()
    await db.refresh(incident)
    return ApiResponse(data=await resolve_incident_response(db, incident), message="Incident updated")


# ─────────────────────────────────────────────────────────────────────────────
# STATUS UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/{incident_id}/status",
    response_model=ApiResponse[IncidentResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER"]))],
)
async def update_incident_status(incident_id: str, body: IncidentStatusUpdate, db: DB):
    incident = await _get_incident_or_404(incident_id, db)
    incident.status = body.status
    if body.resolution_notes:
        incident.resolution_notes = body.resolution_notes
    if body.status in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED) and not incident.resolved_at:
        incident.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(incident)
    return ApiResponse(data=await resolve_incident_response(db, incident), message="Status updated")


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/{incident_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_incident(incident_id: str, db: DB):
    incident = await _get_incident_or_404(incident_id, db)
    await db.delete(incident)
    await db.commit()
    return ApiResponse(data={"id": incident_id}, message="Incident deleted")


# ─────────────────────────────────────────────────────────────────────────────
# ATTACHMENTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/{incident_id}/attachments",
    response_model=ApiResponse[IncidentAttachmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_attachment(
    incident_id:  str,
    body:         IncidentAttachmentCreate,
    db:           DB,
    current_user: User = Depends(get_current_user),
):
    await _get_incident_or_404(incident_id, db)
    att = IncidentAttachment(
        incident_id=incident_id,
        uploaded_by=current_user.id,
        **body.model_dump(),
    )
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return ApiResponse(
        data=IncidentAttachmentResponse.model_validate(att),
        message="Attachment added",
    )


@router.delete(
    "/{incident_id}/attachments/{attachment_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER"]))],
)
async def delete_attachment(incident_id: str, attachment_id: str, db: DB):
    result = await db.execute(
        select(IncidentAttachment).where(
            IncidentAttachment.id == attachment_id,
            IncidentAttachment.incident_id == incident_id,
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    await db.delete(att)
    await db.commit()
    return ApiResponse(data={"id": attachment_id}, message="Attachment deleted")