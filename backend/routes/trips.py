"""
routers/trips.py
Fleet Management System — Phase 5

Changes (availability refactor):
  - All guard/sync logic moved to services/trips.py
  - New GET /trips/availability endpoint (registered BEFORE /{trip_id}
    so FastAPI's path matcher never mistakes "availability" for a trip ID)
  - create_trip / update_trip now call assert_resources_available with
    the trip's actual date range — replaces the old status-only check
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Annotated, Optional
from services.notification_service import notify_trip_assigned, notify_trip_status_changed
from services.trip_service import (
    assert_resources_available,
    get_availability,
    mark_resources_in_progress,
    release_resources,
)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc

from db.dbconfig import DB
from db.models import Trip, TripLocationPing, Truck, Trailer, Driver, User
from schemas.trips import (
    TripCreate, TripUpdate, TripResponse, TripStatusUpdateRequest,
    TripLocationPingResponse, AvailabilityResponse,
)
from schemas.common import UserRole, TripStatus, PaginationMeta, PaginatedResponse
from services.geocoding import maybe_geocode
from auth.deps import require_roles, get_current_user

router = APIRouter(prefix="/trips", tags=["trips"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

async def generate_trip_number(db: DB) -> str:
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


async def resolve_trip_response(db: DB, trip: Trip, include_ping: bool = True) -> TripResponse:
    truck_plate = trailer_plate = driver_name = None
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
        last_ping=last_ping,
    )


# ─────────────────────────────────────────────────────────────────────────────
# AVAILABILITY  — must be registered BEFORE /{trip_id} routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/availability", response_model=AvailabilityResponse)
async def get_trip_availability(
    db: DB,
    _: Annotated[User, Depends(require_roles([
        UserRole.ADMIN, UserRole.DISPATCHER
    ]))],
    departure:       Optional[datetime] = Query(None, description="ISO 8601 start of the trip"),
    arrival:         Optional[datetime] = Query(None, description="ISO 8601 end of the trip"),
    exclude_trip_id: Optional[str]      = Query(None, description="Trip ID to exclude — pass the current trip ID in edit mode"),
):
    """
    Return all active trucks, trailers, and drivers with availability status.

    When departure & arrival are provided, each resource is checked for
    date-range overlap with existing pending/en-route trips.
    When omitted, all resources are returned with available=True
    (used for the initial TripForm render before dates are entered).
    """
    return await get_availability(db, departure, arrival, exclude_trip_id)


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse)
async def list_trips(
    db: DB,
    current_user: Annotated[User, Depends(get_current_user)],
    status: Optional[TripStatus] = Query(None),
    search: Optional[str]        = Query(None),
    truck_id:   Optional[str]    = Query(None),
    trailer_id: Optional[str]    = Query(None),
    page:      int = Query(1,  ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = select(Trip)

    if current_user.role == UserRole.DRIVER:
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )
        driver = driver_result.scalar_one_or_none()
        if not driver:
            return PaginatedResponse(
                data=[],
                meta=PaginationMeta(page=page, page_size=page_size, total_items=0,
                                    total_pages=0, has_next_page=False, has_previous_page=False),
            )
        query = query.where(Trip.assigned_driver_id == driver.id)

    if status:
        query = query.where(Trip.status == status)
    if search:
        term = f"%{search}%"
        query = query.where(
            Trip.trip_number.ilike(term) |
            Trip.origin.ilike(term) |
            Trip.destination.ilike(term)
        )
    if truck_id:
        query = query.where(Trip.assigned_truck_id == truck_id)
    if trailer_id:
        query = query.where(Trip.assigned_trailer_id == trailer_id)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(desc(Trip.created_at)).offset((page - 1) * page_size).limit(page_size)
    trips = (await db.execute(query)).scalars().all()

    items = [await resolve_trip_response(db, t) for t in trips]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse(
        data=items,
        meta=PaginationMeta(
            page=page, page_size=page_size, total_items=total,
            total_pages=total_pages,
            has_next_page=page < total_pages,
            has_previous_page=page > 1,
        ),
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
    # ── Date-range availability guards ────────────────────────────────────────
    await assert_resources_available(
        db,
        departure=data.scheduled_departure,
        arrival=data.scheduled_arrival,
        truck_id=data.assigned_truck_id,
        trailer_id=data.assigned_trailer_id,
        driver_id=data.assigned_driver_id,
    )

    # ── Geocode ───────────────────────────────────────────────────────────────
    origin_lat, origin_lng = await maybe_geocode(data.origin, data.origin_lat, data.origin_lng)
    dest_lat, dest_lng     = await maybe_geocode(data.destination, data.destination_lat, data.destination_lng)

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
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

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
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Resolve effective departure/arrival (use incoming values or fall back to existing)
    effective_departure = data.scheduled_departure or trip.scheduled_departure
    effective_arrival   = data.scheduled_arrival   or trip.scheduled_arrival

    # Only check resources that are actually changing
    new_truck_id   = data.assigned_truck_id   if data.assigned_truck_id   != trip.assigned_truck_id   else None
    new_trailer_id = data.assigned_trailer_id if data.assigned_trailer_id != trip.assigned_trailer_id else None
    new_driver_id  = data.assigned_driver_id  if data.assigned_driver_id  != trip.assigned_driver_id  else None

    # Also re-check unchanged resources if dates are shifting
    dates_changing = (
        data.scheduled_departure is not None and data.scheduled_departure != trip.scheduled_departure
    ) or (
        data.scheduled_arrival is not None and data.scheduled_arrival != trip.scheduled_arrival
    )

    await assert_resources_available(
        db,
        departure=effective_departure,
        arrival=effective_arrival,
        truck_id=new_truck_id   or (trip.assigned_truck_id   if dates_changing else None),
        trailer_id=new_trailer_id or (trip.assigned_trailer_id if dates_changing else None),
        driver_id=new_driver_id  or (trip.assigned_driver_id  if dates_changing else None),
        exclude_trip_id=trip_id,
    )

    # ── If en-route and truck/trailer swapped, sync statuses ─────────────────
    if trip.status == TripStatus.EN_ROUTE:
        if new_truck_id:
            old_truck = await db.get(Truck, trip.assigned_truck_id) if trip.assigned_truck_id else None
            if old_truck:
                old_truck.status          = "active"
                old_truck.current_trip_id = None
            new_truck = await db.get(Truck, new_truck_id)
            if new_truck:
                new_truck.status          = "in-progress"
                new_truck.current_trip_id = trip.id

        if new_trailer_id:
            old_trailer = await db.get(Trailer, trip.assigned_trailer_id) if trip.assigned_trailer_id else None
            if old_trailer:
                old_trailer.assigned_trip_id = None
            new_trailer = await db.get(Trailer, new_trailer_id)
            if new_trailer:
                new_trailer.assigned_trip_id = trip.id

    # ── Geocoding ─────────────────────────────────────────────────────────────
    update_data = data.model_dump(exclude_unset=True)

    if data.origin is not None and data.origin != trip.origin:
        lat, lng = await maybe_geocode(data.origin, None, None)
        update_data["origin_lat"] = lat
        update_data["origin_lng"] = lng

    if data.destination is not None and data.destination != trip.destination:
        lat, lng = await maybe_geocode(data.destination, None, None)
        update_data["destination_lat"] = lat
        update_data["destination_lng"] = lng

    for field, value in update_data.items():
        setattr(trip, field, value)

    trip.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trip)

    return await resolve_trip_response(db, trip)


# ─────────────────────────────────────────────────────────────────────────────
# STATUS UPDATE (with location ping + resource sync)
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{trip_id}/status", response_model=TripResponse)
async def update_trip_status(
    db: DB,
    current_user: Annotated[User, Depends(get_current_user)],
    trip_id: str,
    data: TripStatusUpdateRequest,
):
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_driver     = current_user.role == UserRole.DRIVER
    is_dispatcher = current_user.role in (UserRole.ADMIN, UserRole.DISPATCHER)

    if is_driver:
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )
        driver = driver_result.scalar_one_or_none()
        if not driver or trip.assigned_driver_id != driver.id:
            raise HTTPException(status_code=403, detail="Not assigned to this trip")

        allowed_transitions = {
            TripStatus.PENDING:  [TripStatus.EN_ROUTE],
            TripStatus.EN_ROUTE: [TripStatus.COMPLETED],
        }
        if (trip.status not in allowed_transitions or
                data.status not in allowed_transitions.get(trip.status, [])):
            raise HTTPException(
                status_code=400,
                detail=f"Drivers cannot transition from {trip.status} to {data.status}",
            )

    if not is_driver and not is_dispatcher:
        raise HTTPException(status_code=403, detail="Not authorized")

    old_status  = trip.status
    trip.status = data.status
    trip.updated_at = datetime.now(timezone.utc)

    if data.status == TripStatus.EN_ROUTE and not trip.actual_departure:
        trip.actual_departure = datetime.now(timezone.utc)
    if data.status == TripStatus.COMPLETED and not trip.actual_arrival:
        trip.actual_arrival = datetime.now(timezone.utc)

    # ── Resource sync via service ─────────────────────────────────────────────
    if data.status == TripStatus.EN_ROUTE:
        await mark_resources_in_progress(db, trip)
    elif data.status in (TripStatus.COMPLETED, TripStatus.CANCELLED):
        await release_resources(db, trip)

    if data.location_lat is not None and data.location_lng is not None:
        db.add(TripLocationPing(
            trip_id=trip_id,
            lat=data.location_lat,
            lng=data.location_lng,
            recorded_by=current_user.id,
            notes=data.notes,
        ))

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
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status == TripStatus.EN_ROUTE:
        await release_resources(db, trip)

    await db.delete(trip)
    await db.commit()


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
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

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
    return [TripLocationPingResponse.model_validate(p) for p in result.scalars().all()]