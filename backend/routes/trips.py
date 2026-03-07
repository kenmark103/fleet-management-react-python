"""
routers/trips.py
Fleet Management System — Phase 5

Endpoints:
  GET    /trips              → List (role-filtered)
  POST   /trips              → Create (ADMIN, DISPATCHER)
  GET    /trips/{id}         → Detail
  PATCH  /trips/{id}         → Update (ADMIN, DISPATCHER)
  PATCH  /trips/{id}/status  → Status update (role-aware, creates ping)
  DELETE /trips/{id}         → Delete (ADMIN only)
  GET    /trips/{id}/pings   → Location history
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Annotated, Optional
from services.notification_service import notify_trip_assigned, notify_trip_status_changed

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from db.dbconfig import DB
from db.models import Trip, TripLocationPing, Truck, Trailer, Driver, User
from schemas.trips import (
    TripCreate, TripUpdate, TripResponse, TripStatusUpdateRequest,
    TripLocationPingResponse
)
from schemas.common import UserRole, TripStatus, PaginationMeta, PaginatedResponse
from services.geocoding import maybe_geocode
from auth.deps import require_roles, get_current_user

router = APIRouter(prefix="/trips", tags=["trips"])



# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

async def generate_trip_number(db: DB) -> str:
    """Generate next trip number: TRP-00001, TRP-00002, etc."""
    result = await db.execute(
        select(Trip.trip_number).order_by(desc(Trip.created_at)).limit(1)
    )
    last = result.scalar_one_or_none()

    if not last or not last.startswith("TRP-"):
        return "TRP-00001"

    try:
        num = int(last.split("-")[1])
        return f"TRP-{num + 1:05d}"
    except (IndexError, ValueError):
        return "TRP-00001"


async def resolve_trip_response(
        db: DB,
        trip: Trip,
        include_ping: bool = True
) -> TripResponse:
    """Build TripResponse with denormalized fields and latest ping."""

    # Fetch related names in single query
    truck_plate = None
    trailer_plate = None
    driver_name = None
    dispatcher_name = ""

    if trip.assigned_truck_id:
        t = await db.get(Truck, trip.assigned_truck_id)
        truck_plate = t.plate_number if t else None

    if trip.assigned_trailer_id:
        t = await db.get(Trailer, trip.assigned_trailer_id)
        trailer_plate = t.plate_number if t else None

    if trip.assigned_driver_id:
        d = await db.get(Driver, trip.assigned_driver_id)
        if d:
            driver_name = f"{d.first_name} {d.last_name}"

    if trip.dispatched_by:
        u = await db.get(User, trip.dispatched_by)
        if u:
            dispatcher_name = f"{u.first_name} {u.last_name}"

    # Get latest ping
    last_ping = None
    if include_ping:
        ping_result = await db.execute(
            select(TripLocationPing)
            .where(TripLocationPing.trip_id == trip.id)
            .order_by(desc(TripLocationPing.recorded_at))
            .limit(1)
        )
        ping = ping_result.scalar_one_or_none()
        if ping:
            last_ping = TripLocationPingResponse.model_validate(ping)

    return TripResponse(
        **trip.__dict__,
        assigned_truck_plate=truck_plate,
        assigned_trailer_plate=trailer_plate,
        assigned_driver_name=driver_name,
        dispatched_by_name=dispatcher_name,
        last_ping=last_ping
    )


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse)
async def list_trips(
        db: DB,
        current_user: Annotated[User, Depends(get_current_user)],
        status: Optional[TripStatus] = Query(None),
        search: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
):
    """
    List trips with role-based filtering:
    - DRIVER: only their assigned trips
    - FINANCE: all trips (read-only view)
    - ADMIN/DISPATCHER: all trips
    """
    query = select(Trip)

    # Role filter
    if current_user.role == UserRole.DRIVER:
        # Find driver profile for this user
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )
        driver = driver_result.scalar_one_or_none()
        if not driver:
            # No driver profile = no trips
            return PaginatedResponse(
                data=[],
                meta=PaginationMeta(
                    page=page, page_size=page_size,
                    total_items=0, total_pages=0,
                    has_next_page=False, has_previous_page=False
                )
            )
        query = query.where(Trip.assigned_driver_id == driver.id)

    # Status filter
    if status:
        query = query.where(Trip.status == status)

    # Search (trip number, origin, destination)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Trip.trip_number.ilike(search_term)) |
            (Trip.origin.ilike(search_term)) |
            (Trip.destination.ilike(search_term))
        )

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    # Pagination
    query = query.order_by(desc(Trip.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    trips = result.scalars().all()

    # Build responses
    items = [await resolve_trip_response(db, t) for t in trips]

    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        data=items,
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next_page=page < total_pages,
            has_previous_page=page > 1
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
        db: DB,
        current_user: Annotated[User, Depends(require_roles([UserRole.ADMIN, UserRole.DISPATCHER]))],
        data: TripCreate,
):
    """Create new trip with auto-geocoding and trip number generation."""

    # Geocode origin/destination if coords not provided
    origin_lat, origin_lng = await maybe_geocode(
        data.origin, data.origin_lat, data.origin_lng
    )
    dest_lat, dest_lng = await maybe_geocode(
        data.destination, data.destination_lat, data.destination_lng
    )

    trip = Trip(
        trip_number=await generate_trip_number(db),
        origin=data.origin,
        destination=data.destination,
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        destination_lat=dest_lat,
        destination_lng=dest_lng,
        scheduled_departure=data.scheduled_departure,
        scheduled_arrival=data.scheduled_arrival,
        distance_km=data.distance_km,
        cargo_description=data.cargo_description,
        cargo_weight_tons=data.cargo_weight_tons,
        assigned_truck_id=data.assigned_truck_id,
        assigned_trailer_id=data.assigned_trailer_id,
        assigned_driver_id=data.assigned_driver_id,
        dispatched_by=current_user.id,
        notes=data.notes,
        status=TripStatus.PENDING,
    )

    db.add(trip)
    await notify_trip_assigned(db, trip)
    await db.commit()
    await db.refresh(trip)

    return await resolve_trip_response(db, trip)


# ─────────────────────────────────────────────────────────────────────────────
# DETAIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
        db: DB,
        current_user: Annotated[User, Depends(get_current_user)],
        trip_id: str,
):
    """Get single trip detail. Drivers can only view their own."""

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Permission check
    if current_user.role == UserRole.DRIVER:
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )
        driver = driver_result.scalar_one_or_none()
        if not driver or trip.assigned_driver_id != driver.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this trip")

    return await resolve_trip_response(db, trip)


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(
        db: DB,
        current_user: Annotated[User, Depends(require_roles([UserRole.ADMIN, UserRole.DISPATCHER]))],
        trip_id: str,
        data: TripUpdate,
):
    """Update trip details. Re-geocodes if origin/destination changed."""

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Track if we need to re-geocode
    origin_changed = data.origin is not None and data.origin != trip.origin
    dest_changed = data.destination is not None and data.destination != trip.destination

    update_data = data.model_dump(exclude_unset=True)

    # Handle geocoding updates
    if origin_changed:
        lat, lng = await maybe_geocode(data.origin, None, None)
        update_data["origin_lat"] = lat
        update_data["origin_lng"] = lng

    if dest_changed:
        lat, lng = await maybe_geocode(data.destination, None, None)
        update_data["destination_lat"] = lat
        update_data["destination_lng"] = lng

    # Apply updates
    for field, value in update_data.items():
        setattr(trip, field, value)

    trip.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trip)

    return await resolve_trip_response(db, trip)


# ─────────────────────────────────────────────────────────────────────────────
# STATUS UPDATE (with location ping)
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{trip_id}/status", response_model=TripResponse)
async def update_trip_status(
        db: DB,
        current_user: Annotated[User, Depends(get_current_user)],
        trip_id: str,
        data: TripStatusUpdateRequest,
):
    """
    Update trip status. Creates a location ping if coords provided.
    - ADMIN/DISPATCHER: can update any trip to any status
    - DRIVER: can only update their own assigned trip
    """

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Permission checks
    is_driver = current_user.role == UserRole.DRIVER
    is_dispatcher = current_user.role in (UserRole.ADMIN, UserRole.DISPATCHER)

    if is_driver:
        # Verify this is their trip
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )
        driver = driver_result.scalar_one_or_none()
        if not driver or trip.assigned_driver_id != driver.id:
            raise HTTPException(status_code=403, detail="Not assigned to this trip")

        # Drivers have limited status transitions
        allowed_driver_transitions = {
            TripStatus.PENDING: [TripStatus.EN_ROUTE],
            TripStatus.EN_ROUTE: [TripStatus.COMPLETED],
        }
        current = trip.status
        new = data.status
        if current not in allowed_driver_transitions or new not in allowed_driver_transitions.get(current, []):
            raise HTTPException(
                status_code=400,
                detail=f"Drivers cannot transition from {current} to {new}"
            )

    if not is_driver and not is_dispatcher:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update status
    old_status = trip.status
    trip.status = data.status
    trip.updated_at = datetime.now(timezone.utc)

    # Set actual timestamps based on status
    if data.status == TripStatus.EN_ROUTE and not trip.actual_departure:
        trip.actual_departure = datetime.now(timezone.utc)
    if data.status == TripStatus.COMPLETED and not trip.actual_arrival:
        trip.actual_arrival = datetime.now(timezone.utc)

    # Create location ping if coords provided
    if data.location_lat is not None and data.location_lng is not None:
        ping = TripLocationPing(
            trip_id=trip_id,
            lat=data.location_lat,
            lng=data.location_lng,
            recorded_by=current_user.id,
            notes=data.notes
        )
        db.add(ping)

    await notify_trip_status_changed(db, trip, old_status, current_user.id)
    await db.commit()
    await db.refresh(trip)

    return await resolve_trip_response(db, trip)


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
        db: DB,
        current_user: Annotated[User, Depends(require_roles([UserRole.ADMIN]))],
        trip_id: str,
):
    """Hard delete trip (ADMIN only)."""

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    await db.delete(trip)
    await db.commit()

    return None


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION PINGS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{trip_id}/pings", response_model=list[TripLocationPingResponse])
async def get_trip_pings(
        db: DB,
        current_user: Annotated[User, Depends(get_current_user)],
        trip_id: str,
        limit: int = Query(100, ge=1, le=500),
):
    """
    Get location ping history for a trip.
    - DRIVER: only if assigned to trip
    - Others: any trip they can view
    """

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Permission check for drivers
    if current_user.role == UserRole.DRIVER:
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )
        driver = driver_result.scalar_one_or_none()
        if not driver or trip.assigned_driver_id != driver.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(TripLocationPing)
        .where(TripLocationPing.trip_id == trip_id)
        .order_by(desc(TripLocationPing.recorded_at))
        .limit(limit)
    )
    pings = result.scalars().all()

    return [TripLocationPingResponse.model_validate(p) for p in pings]