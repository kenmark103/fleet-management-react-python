from __future__ import annotations
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from db.models import Truck, Trailer
from schemas.fleet import (
    TruckCreate, TruckUpdate,
    TrailerCreate, TrailerUpdate,
    FleetSummary,
)
from schemas.common import TruckStatus, TrailerStatus


# ── Trucks ─────────────────────────────────────────────────────────────────────

async def get_truck(db: AsyncSession, truck_id: str) -> Truck:
    truck = await db.get(Truck, truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return truck


async def list_trucks(
    db: AsyncSession,
    *,
    status: TruckStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Truck]:
    q = select(Truck)
    if status:
        q = q.where(Truck.status == status.value)
    q = q.order_by(Truck.plate_number).offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_truck(db: AsyncSession, payload: TruckCreate) -> Truck:
    # Enforce unique plate_number
    existing = await db.execute(
        select(Truck).where(Truck.plate_number == payload.plate_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A truck with plate number '{payload.plate_number}' already exists",
        )
    truck = Truck(**payload.model_dump())
    db.add(truck)
    await db.commit()
    await db.refresh(truck)
    return truck


async def update_truck(db: AsyncSession, truck_id: str, payload: TruckUpdate) -> Truck:
    truck = await get_truck(db, truck_id)
    data = payload.model_dump(exclude_unset=True)

    # If plate_number is being changed, check uniqueness
    if "plate_number" in data and data["plate_number"] != truck.plate_number:
        existing = await db.execute(
            select(Truck).where(Truck.plate_number == data["plate_number"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Plate number '{data['plate_number']}' is already in use",
            )

    for field, value in data.items():
        setattr(truck, field, value)

    await db.commit()
    await db.refresh(truck)
    return truck


async def delete_truck(db: AsyncSession, truck_id: str) -> None:
    truck = await get_truck(db, truck_id)
    await db.delete(truck)
    await db.commit()


# ── Trailers ───────────────────────────────────────────────────────────────────

async def get_trailer(db: AsyncSession, trailer_id: str) -> Trailer:
    trailer = await db.get(Trailer, trailer_id)
    if not trailer:
        raise HTTPException(status_code=404, detail="Trailer not found")
    return trailer


async def list_trailers(
    db: AsyncSession,
    *,
    status: TrailerStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Trailer]:
    q = select(Trailer)
    if status:
        q = q.where(Trailer.status == status.value)
    q = q.order_by(Trailer.plate_number).offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_trailer(db: AsyncSession, payload: TrailerCreate) -> Trailer:
    existing = await db.execute(
        select(Trailer).where(Trailer.plate_number == payload.plate_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A trailer with plate number '{payload.plate_number}' already exists",
        )
    trailer = Trailer(**payload.model_dump())
    db.add(trailer)
    await db.commit()
    await db.refresh(trailer)
    return trailer


async def update_trailer(
    db: AsyncSession, trailer_id: str, payload: TrailerUpdate
) -> Trailer:
    trailer = await get_trailer(db, trailer_id)
    data = payload.model_dump(exclude_unset=True)

    if "plate_number" in data and data["plate_number"] != trailer.plate_number:
        existing = await db.execute(
            select(Trailer).where(Trailer.plate_number == data["plate_number"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Plate number '{data['plate_number']}' is already in use",
            )

    for field, value in data.items():
        setattr(trailer, field, value)

    await db.commit()
    await db.refresh(trailer)
    return trailer


async def delete_trailer(db: AsyncSession, trailer_id: str) -> None:
    trailer = await get_trailer(db, trailer_id)
    await db.delete(trailer)
    await db.commit()


# ── Fleet Summary ──────────────────────────────────────────────────────────────

async def get_fleet_summary(db: AsyncSession) -> FleetSummary:
    async def count(model, where=None):
        q = select(func.count()).select_from(model)
        if where is not None:
            q = q.where(where)
        return (await db.execute(q)).scalar_one()

    return FleetSummary(
        total_trucks=       await count(Truck),
        active_trucks=      await count(Truck,   Truck.status == TruckStatus.ACTIVE.value),
        in_progress_trucks= await count(Truck,   Truck.status == TruckStatus.IN_PROGRESS.value),
        inactive_trucks=    await count(Truck,   Truck.status == TruckStatus.INACTIVE.value),
        total_trailers=     await count(Trailer),
        active_trailers=    await count(Trailer, Trailer.status == TrailerStatus.ACTIVE.value),
        inactive_trailers=  await count(Trailer, Trailer.status == TrailerStatus.INACTIVE.value),
    )