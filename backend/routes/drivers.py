"""
routers/drivers.py
Fleet Management System

CREATE endpoint change (invite flow):
  OLD: Created User (role=DRIVER) + Driver atomically, required temp_password.
  NEW: Accepts an existing user_id from DriverCreate.
       The User account already exists (created via invite → accept-invite flow).
       This endpoint only creates the Driver profile row and links it.

       Guards:
         1. user_id must resolve to an existing, active User
         2. that User must have role == DRIVER
         3. no Driver profile must already exist for that user_id
         4. license_number must be unique

All other endpoints (UPDATE, DELETE, documents, trips) are unchanged.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_

from db.dbconfig import DB
from db.models import Driver, DriverDocument, Trip, User
from schemas.common import PaginatedResponse, PaginationMeta, ApiResponse
from schemas.drivers import (
    DriverCreate,
    DriverUpdate,
    DriverResponse,
    DriverDocumentCreate,
    DriverDocumentResponse,
    DriverSummary,
)
from auth.deps import get_current_user, require_roles

router = APIRouter(prefix="/drivers", tags=["drivers"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

async def _get_driver_or_404(driver_id: str, db: DB) -> Driver:
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY  — must be before /{id} routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/summary",
    response_model=ApiResponse[DriverSummary],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER"]))],
)
async def get_driver_summary(db: DB):
    total_q    = await db.execute(select(func.count(Driver.id)))
    active_q   = await db.execute(select(func.count(Driver.id)).where(Driver.status == "active"))
    inactive_q = await db.execute(select(func.count(Driver.id)).where(Driver.status == "inactive"))

    threshold  = datetime.now(timezone.utc) + timedelta(days=30)
    expiring_q = await db.execute(
        select(func.count(Driver.id)).where(Driver.license_expiry_date <= threshold)
    )

    return ApiResponse(data=DriverSummary(
        total_drivers=total_q.scalar_one(),
        active_drivers=active_q.scalar_one(),
        inactive_drivers=inactive_q.scalar_one(),
        expiring_licenses_30d=expiring_q.scalar_one(),
    ))


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=PaginatedResponse[DriverResponse],
    dependencies=[Depends(require_roles(["ADMIN", "DISPATCHER"]))],
)
async def list_drivers(
    db:        DB,
    page:      int           = Query(1, ge=1),
    page_size: int           = Query(20, ge=1, le=100),
    status:    Optional[str] = Query(None),
    search:    Optional[str] = Query(None),
):
    q = select(Driver)

    if status:
        q = q.where(Driver.status == status)

    if search:
        term = f"%{search}%"
        q = q.where(
            or_(
                Driver.first_name.ilike(term),
                Driver.last_name.ilike(term),
                Driver.email.ilike(term),
                Driver.license_number.ilike(term),
                Driver.phone.ilike(term),
            )
        )

    total       = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    offset      = (page - 1) * page_size
    result      = await db.execute(
        q.offset(offset).limit(page_size).order_by(Driver.last_name, Driver.first_name)
    )
    drivers     = result.scalars().all()
    total_pages = max(1, -(-total // page_size))

    return PaginatedResponse(
        data=[DriverResponse.model_validate(d) for d in drivers],
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
# CREATE  — links an existing User to a new Driver profile
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=ApiResponse[DriverResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_driver(
    body:         DriverCreate,
    db:           DB,
    current_user: User = Depends(get_current_user),
):
    """
    Creates a Driver profile row linked to an existing User account.

    Who can call this:
      - ADMIN: can create a profile for any DRIVER-role user.
      - DRIVER: can only create a profile for themselves (their own user_id).
        This is the self-service path used by /drivers/setup after first login.

    The User account must already exist and have been activated via the
    invite flow before this endpoint is called.
    """

    # ── Permission: DRIVER can only create their own profile ──────────────
    if current_user.role == "DRIVER":
        if body.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Drivers can only create their own profile",
            )
    elif current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # ── Guard 1: user_id must resolve to a real, active User ──────────────
    user = await db.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="User account is inactive — cannot create a driver profile",
        )

    # ── Guard 2: that User must have role DRIVER ───────────────────────────
    if user.role != "DRIVER":
        raise HTTPException(
            status_code=400,
            detail=f"User role is '{user.role}' — only DRIVER accounts can have a driver profile",
        )

    # ── Guard 3: no Driver profile must already exist for this user ────────
    existing_profile = (
        await db.execute(select(Driver).where(Driver.user_id == body.user_id))
    ).scalar_one_or_none()
    if existing_profile:
        raise HTTPException(
            status_code=409,
            detail="A driver profile already exists for this account",
        )

    # ── Guard 4: license number must be unique across all drivers ──────────
    existing_license = (
        await db.execute(select(Driver).where(Driver.license_number == body.license_number))
    ).scalar_one_or_none()
    if existing_license:
        raise HTTPException(
            status_code=409,
            detail="License number is already registered to another driver",
        )

    # ── Create the Driver profile (User row already exists — don't touch it) ─
    driver_data = body.model_dump(exclude={"user_id"})  # user_id set explicitly below
    driver = Driver(**driver_data, user_id=body.user_id)
    db.add(driver)
    await db.commit()
    await db.refresh(driver)

    return ApiResponse(
        data=DriverResponse.model_validate(driver),
        message=f"Driver profile created for {driver.first_name} {driver.last_name}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# DETAIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{driver_id}", response_model=ApiResponse[DriverResponse])
async def get_driver(
    driver_id:    str,
    current_user: User = Depends(get_current_user),
    db:           DB   = None,
):
    driver = await _get_driver_or_404(driver_id, db)

    if current_user.role == "DRIVER":
        own = (
            await db.execute(select(Driver).where(Driver.user_id == current_user.id))
        ).scalar_one_or_none()
        if not own or own.id != driver_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role not in ("ADMIN", "DISPATCHER"):
        raise HTTPException(status_code=403, detail="Access denied")

    return ApiResponse(data=DriverResponse.model_validate(driver))


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE  — mirrors identity fields to the linked User row
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/{driver_id}",
    response_model=ApiResponse[DriverResponse],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def update_driver(driver_id: str, body: DriverUpdate, db: DB):
    driver = await _get_driver_or_404(driver_id, db)

    # License uniqueness guard
    if body.license_number and body.license_number != driver.license_number:
        clash = (
            await db.execute(
                select(Driver).where(Driver.license_number == body.license_number)
            )
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(status_code=409, detail="License number already registered")

    update_data = body.model_dump(exclude_unset=True)

    # Email uniqueness guard
    if "email" in update_data and update_data["email"] != driver.email:
        clash = (
            await db.execute(
                select(User).where(
                    User.email == update_data["email"],
                    User.id != driver.user_id,
                )
            )
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(status_code=409, detail="Email is already in use")

    # Apply to Driver row
    for field, value in update_data.items():
        setattr(driver, field, value)

    # Mirror identity fields to the linked User row so login stays in sync
    USER_MIRROR_FIELDS = {"first_name", "last_name", "email", "phone", "avatar_url"}
    mirrored = {k: v for k, v in update_data.items() if k in USER_MIRROR_FIELDS}

    if mirrored:
        linked_user = (
            await db.execute(select(User).where(User.id == driver.user_id))
        ).scalar_one_or_none()
        if linked_user:
            for field, value in mirrored.items():
                setattr(linked_user, field, value)

    await db.commit()
    await db.refresh(driver)

    return ApiResponse(data=DriverResponse.model_validate(driver), message="Driver updated")


# ─────────────────────────────────────────────────────────────────────────────
# DELETE  — hard-deletes Driver, soft-deactivates linked User
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/{driver_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_driver(driver_id: str, db: DB):
    driver = await _get_driver_or_404(driver_id, db)

    active_trip = (
        await db.execute(
            select(Trip).where(
                Trip.assigned_driver_id == driver_id,
                Trip.status == "en-route",
            )
        )
    ).scalar_one_or_none()
    if active_trip:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a driver currently on an active trip",
        )

    linked_user = (
        await db.execute(select(User).where(User.id == driver.user_id))
    ).scalar_one_or_none()
    if linked_user:
        linked_user.is_active = False

    await db.delete(driver)
    await db.commit()

    return ApiResponse(
        data={"id": driver_id},
        message="Driver removed and login account deactivated",
    )


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{driver_id}/documents",
    response_model=ApiResponse[list[DriverDocumentResponse]],
)
async def list_driver_documents(
    driver_id:    str,
    current_user: User = Depends(get_current_user),
    db:           DB   = None,
):
    await _get_driver_or_404(driver_id, db)

    if current_user.role == "DRIVER":
        own = (
            await db.execute(select(Driver).where(Driver.user_id == current_user.id))
        ).scalar_one_or_none()
        if not own or own.id != driver_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role not in ("ADMIN", "DISPATCHER"):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(DriverDocument)
        .where(DriverDocument.driver_id == driver_id)
        .order_by(DriverDocument.uploaded_at.desc())
    )
    return ApiResponse(data=[DriverDocumentResponse.model_validate(d) for d in result.scalars().all()])


@router.post(
    "/{driver_id}/documents",
    response_model=ApiResponse[DriverDocumentResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def upload_driver_document(
    driver_id:    str,
    body:         DriverDocumentCreate,
    current_user: User = Depends(get_current_user),
    db:           DB   = None,
):
    await _get_driver_or_404(driver_id, db)

    doc = DriverDocument(
        driver_id=driver_id,
        uploaded_by=current_user.id,
        **body.model_dump(),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return ApiResponse(
        data=DriverDocumentResponse.model_validate(doc),
        message="Document uploaded",
    )


@router.delete(
    "/{driver_id}/documents/{doc_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_driver_document(driver_id: str, doc_id: str, db: DB):
    result = await db.execute(
        select(DriverDocument).where(
            DriverDocument.id == doc_id,
            DriverDocument.driver_id == driver_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(doc)
    await db.commit()

    return ApiResponse(data={"id": doc_id}, message="Document deleted")


# ─────────────────────────────────────────────────────────────────────────────
# TRIP HISTORY
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{driver_id}/trips", response_model=PaginatedResponse[dict])
async def get_driver_trips(
    driver_id:    str,
    current_user: User = Depends(get_current_user),
    db:           DB   = None,
    page:         int  = Query(1, ge=1),
    page_size:    int  = Query(20, ge=1, le=100),
):
    await _get_driver_or_404(driver_id, db)

    if current_user.role == "DRIVER":
        own = (
            await db.execute(select(Driver).where(Driver.user_id == current_user.id))
        ).scalar_one_or_none()
        if not own or own.id != driver_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role not in ("ADMIN", "DISPATCHER"):
        raise HTTPException(status_code=403, detail="Access denied")

    q           = select(Trip).where(Trip.assigned_driver_id == driver_id)
    total       = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    offset      = (page - 1) * page_size
    result      = await db.execute(
        q.offset(offset).limit(page_size).order_by(Trip.scheduled_departure.desc())
    )
    trips       = result.scalars().all()
    total_pages = max(1, -(-total // page_size))

    data = [
        {
            "id":                 t.id,
            "tripNumber":         t.trip_number,
            "status":             t.status,
            "origin":             t.origin,
            "destination":        t.destination,
            "scheduledDeparture": t.scheduled_departure.isoformat(),
            "scheduledArrival":   t.scheduled_arrival.isoformat(),
            "actualDeparture":    t.actual_departure.isoformat() if t.actual_departure else None,
            "actualArrival":      t.actual_arrival.isoformat() if t.actual_arrival else None,
            "assignedTruckId":    t.assigned_truck_id,
        }
        for t in trips
    ]

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