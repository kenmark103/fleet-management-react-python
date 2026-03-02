from __future__ import annotations
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from auth.deps import get_current_user, require_roles
from db.dbconfig import DB
from db.models import User
from schemas.fleet import (
    TruckCreate, TruckUpdate, TruckResponse,
    TrailerCreate, TrailerUpdate, TrailerResponse,
    FleetSummary,
)
from services import fleet as svc
from schemas.common import TruckStatus, TrailerStatus

router = APIRouter(prefix="/fleet", tags=["fleet"])

# ── Role dependency aliases ────────────────────────────────────────────────────
# Viewers: all roles except DRIVER (matches trucks:view-list permission matrix)
ViewerDep  = Depends(require_roles(["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE"]))
AdminDep   = Depends(require_roles(["ADMIN"]))


# ── Summary ────────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=FleetSummary)
async def get_fleet_summary(
    db: DB,
    _: User = ViewerDep,
):
    return await svc.get_fleet_summary(db)


# ── Trucks ─────────────────────────────────────────────────────────────────────

@router.get("/trucks", response_model=list[TruckResponse])
async def list_trucks(
    db: DB,
    status: TruckStatus | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _: User = ViewerDep,
):
    return await svc.list_trucks(db, status=status, skip=skip, limit=limit)


@router.post("/trucks", response_model=TruckResponse, status_code=status.HTTP_201_CREATED)
async def create_truck(
    db: DB,
    payload: TruckCreate,
    _: User = AdminDep,
):
    return await svc.create_truck(db, payload)


@router.get("/trucks/{truck_id}", response_model=TruckResponse)
async def get_truck(
    truck_id: str,
    db: DB,
    _: User = ViewerDep,
):
    return await svc.get_truck(db, truck_id)


@router.patch("/trucks/{truck_id}", response_model=TruckResponse)
async def update_truck(
    truck_id: str,
    db: DB,
    payload: TruckUpdate,
    _: User = AdminDep,
):
    return await svc.update_truck(db, truck_id, payload)


@router.delete("/trucks/{truck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_truck(
    truck_id: str,
    db: DB,
    _: User = AdminDep,
):
    await svc.delete_truck(db, truck_id)


# ── Trailers ───────────────────────────────────────────────────────────────────

@router.get("/trailers", response_model=list[TrailerResponse])
async def list_trailers(
    db: DB,
    status: TrailerStatus | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _: User = ViewerDep,
):
    return await svc.list_trailers(db, status=status, skip=skip, limit=limit)


@router.post("/trailers", response_model=TrailerResponse, status_code=status.HTTP_201_CREATED)
async def create_trailer(
    db: DB,
    payload: TrailerCreate,
    _: User = AdminDep,
):
    return await svc.create_trailer(db, payload)


@router.get("/trailers/{trailer_id}", response_model=TrailerResponse)
async def get_trailer(
    trailer_id: str,
    db: DB,
    _: User = ViewerDep,
):
    return await svc.get_trailer(db, trailer_id)


@router.patch("/trailers/{trailer_id}", response_model=TrailerResponse)
async def update_trailer(
    trailer_id: str,
    db: DB,
    payload: TrailerUpdate,
    _: User = AdminDep,
):
    return await svc.update_trailer(db, trailer_id, payload)


@router.delete("/trailers/{trailer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trailer(
    trailer_id: str,
    db: DB,
    _: User = AdminDep,
):
    await svc.delete_trailer(db, trailer_id)