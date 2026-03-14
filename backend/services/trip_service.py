"""
services/trips.py
Fleet Management System

Trip service layer — extracted from routers/trips.py.

Responsibilities:
  - Date-range overlap checking (replaces the old status-only guards)
  - Resource availability querying for the TripForm dropdowns
  - Resource status sync helpers (en-route ↔ active transitions)

Overlap logic:
  Two trips conflict when:
      existing.scheduled_departure < new.arrival
      AND
      existing.scheduled_arrival   > new.departure
  This is the standard half-open interval intersection test.
  Only trips with status "pending" or "en-route" are considered —
  completed / cancelled trips free up the resource.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select

from db.dbconfig import DB
from db.models import Trip, Truck, Trailer, Driver
from schemas.trips import (
    TruckAvailability,
    TrailerAvailability,
    DriverAvailability,
    AvailabilityResponse,
)

# Only non-terminal trip statuses block a resource
_BOOKABLE = ("pending", "en-route")


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL — single overlap query
# ─────────────────────────────────────────────────────────────────────────────

async def _find_overlap(
    db: DB,
    column_name: str,        # "assigned_truck_id" | "assigned_trailer_id" | "assigned_driver_id"
    resource_id: str,
    departure: datetime,
    arrival: datetime,
    exclude_trip_id: Optional[str] = None,
) -> Optional[Trip]:
    """
    Return the first Trip that overlaps [departure, arrival] for the
    given resource column, or None if the resource is free.
    """
    col = getattr(Trip, column_name)
    q = (
        select(Trip)
        .where(
            col == resource_id,
            Trip.status.in_(_BOOKABLE),
            Trip.scheduled_departure < arrival,
            Trip.scheduled_arrival   > departure,
        )
    )
    if exclude_trip_id:
        q = q.where(Trip.id != exclude_trip_id)

    result = await db.execute(q)
    return result.scalar_one_or_none()


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC — raise 409 if any resource is double-booked
# ─────────────────────────────────────────────────────────────────────────────

async def assert_resources_available(
    db: DB,
    departure: datetime,
    arrival: datetime,
    truck_id:   Optional[str] = None,
    trailer_id: Optional[str] = None,
    driver_id:  Optional[str] = None,
    exclude_trip_id: Optional[str] = None,
) -> None:
    """
    Raises HTTP 409 with an actionable message if any resource is already
    scheduled during the requested date range.

    Used by both create_trip and update_trip in the router.
    """
    if truck_id:
        conflict = await _find_overlap(
            db, "assigned_truck_id", truck_id,
            departure, arrival, exclude_trip_id,
        )
        if conflict:
            truck = await db.get(Truck, truck_id)
            plate = truck.plate_number if truck else truck_id
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Truck {plate} is already assigned to trip "
                    f"{conflict.trip_number} ({conflict.status}) "
                    f"which overlaps with the selected dates. "
                    f"Complete or cancel that trip first."
                ),
            )

    if trailer_id:
        conflict = await _find_overlap(
            db, "assigned_trailer_id", trailer_id,
            departure, arrival, exclude_trip_id,
        )
        if conflict:
            trailer = await db.get(Trailer, trailer_id)
            plate = trailer.plate_number if trailer else trailer_id
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Trailer {plate} is already assigned to trip "
                    f"{conflict.trip_number} ({conflict.status}) "
                    f"which overlaps with the selected dates. "
                    f"Complete or cancel that trip first."
                ),
            )

    if driver_id:
        conflict = await _find_overlap(
            db, "assigned_driver_id", driver_id,
            departure, arrival, exclude_trip_id,
        )
        if conflict:
            driver = await db.get(Driver, driver_id)
            name = f"{driver.first_name} {driver.last_name}" if driver else driver_id
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Driver {name} is already assigned to trip "
                    f"{conflict.trip_number} ({conflict.status}) "
                    f"which overlaps with the selected dates. "
                    f"Complete or cancel that trip first."
                ),
            )


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC — availability query for TripForm dropdowns
# ─────────────────────────────────────────────────────────────────────────────

async def get_availability(
    db: DB,
    departure: Optional[datetime] = None,
    arrival:   Optional[datetime] = None,
    exclude_trip_id: Optional[str] = None,
) -> AvailabilityResponse:
    """
    Return every active truck, trailer, and driver with an `available` flag
    and the conflicting trip number when unavailable.

    When departure/arrival are omitted all resources are marked available —
    the TripForm calls this on mount before dates are filled in.
    """
    check_dates = departure is not None and arrival is not None

    # ── Trucks ────────────────────────────────────────────────────────────────
    trucks_rows = (
        await db.execute(
            select(Truck)
            .where(Truck.status != "inactive")
            .order_by(Truck.plate_number)
        )
    ).scalars().all()

    truck_list: list[TruckAvailability] = []
    for truck in trucks_rows:
        available           = True
        conflict_trip_number = None
        conflict_trip_id    = None

        if check_dates:
            conflict = await _find_overlap(
                db, "assigned_truck_id", truck.id,
                departure, arrival, exclude_trip_id,  # type: ignore[arg-type]
            )
            if conflict:
                available            = False
                conflict_trip_number = conflict.trip_number
                conflict_trip_id     = conflict.id

        truck_list.append(TruckAvailability(
            id=truck.id,
            plate_number=truck.plate_number,
            make=truck.make,
            model=truck.model,
            year=truck.year,
            fuel_type=truck.fuel_type,
            status=truck.status,
            available=available,
            conflict_trip_number=conflict_trip_number,
            conflict_trip_id=conflict_trip_id,
        ))

    # ── Trailers ──────────────────────────────────────────────────────────────
    trailers_rows = (
        await db.execute(
            select(Trailer)
            .where(Trailer.status != "inactive")
            .order_by(Trailer.plate_number)
        )
    ).scalars().all()

    trailer_list: list[TrailerAvailability] = []
    for trailer in trailers_rows:
        available            = True
        conflict_trip_number = None
        conflict_trip_id     = None

        if check_dates:
            conflict = await _find_overlap(
                db, "assigned_trailer_id", trailer.id,
                departure, arrival, exclude_trip_id,  # type: ignore[arg-type]
            )
            if conflict:
                available            = False
                conflict_trip_number = conflict.trip_number
                conflict_trip_id     = conflict.id

        trailer_list.append(TrailerAvailability(
            id=trailer.id,
            plate_number=trailer.plate_number,
            type=trailer.type,
            capacity_tons=trailer.capacity_tons,
            available=available,
            conflict_trip_number=conflict_trip_number,
            conflict_trip_id=conflict_trip_id,
        ))

    # ── Drivers ───────────────────────────────────────────────────────────────
    drivers_rows = (
        await db.execute(
            select(Driver)
            .where(Driver.status == "active")
            .order_by(Driver.last_name, Driver.first_name)
        )
    ).scalars().all()

    driver_list: list[DriverAvailability] = []
    for driver in drivers_rows:
        available            = True
        conflict_trip_number = None
        conflict_trip_id     = None

        if check_dates:
            conflict = await _find_overlap(
                db, "assigned_driver_id", driver.id,
                departure, arrival, exclude_trip_id,  # type: ignore[arg-type]
            )
            if conflict:
                available            = False
                conflict_trip_number = conflict.trip_number
                conflict_trip_id     = conflict.id

        driver_list.append(DriverAvailability(
            id=driver.id,
            first_name=driver.first_name,
            last_name=driver.last_name,
            license_class=driver.license_class,
            available=available,
            conflict_trip_number=conflict_trip_number,
            conflict_trip_id=conflict_trip_id,
        ))

    return AvailabilityResponse(
        trucks=truck_list,
        trailers=trailer_list,
        drivers=driver_list,
        departure=departure,
        arrival=arrival,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC — resource status sync (called by router on status transitions)
# ─────────────────────────────────────────────────────────────────────────────

async def mark_resources_in_progress(db: DB, trip: Trip) -> None:
    """Called when trip → en-route. Lock the assigned truck and trailer."""
    if trip.assigned_truck_id:
        truck = await db.get(Truck, trip.assigned_truck_id)
        if truck:
            truck.status         = "in-progress"
            truck.current_trip_id = trip.id

    if trip.assigned_trailer_id:
        trailer = await db.get(Trailer, trip.assigned_trailer_id)
        if trailer:
            trailer.assigned_trip_id = trip.id


async def release_resources(db: DB, trip: Trip) -> None:
    """Called when trip → completed or cancelled. Free the truck and trailer."""
    if trip.assigned_truck_id:
        truck = await db.get(Truck, trip.assigned_truck_id)
        if truck:
            truck.status          = "active"
            truck.current_trip_id = None

    if trip.assigned_trailer_id:
        trailer = await db.get(Trailer, trip.assigned_trailer_id)
        if trailer:
            trailer.assigned_trip_id = None