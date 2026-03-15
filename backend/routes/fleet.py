from __future__ import annotations
from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from auth.deps import get_current_user, require_roles
from db.dbconfig import DB
from db.models import User, Truck, Trailer
from schemas.fleet import (
    TruckCreate, TruckUpdate, TruckResponse,
    TrailerCreate, TrailerUpdate, TrailerResponse,
    FleetSummary,
)
from services import fleet as svc
from schemas.common import TruckStatus, TrailerStatus, PaginationMeta, PaginatedResponse
import os, shutil, uuid

router = APIRouter(prefix="/fleet", tags=["fleet"])

# ── Role dependency aliases ────────────────────────────────────────────────────
ViewerDep  = Depends(require_roles(["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE", "DRIVER"]))
AdminDep   = Depends(require_roles(["ADMIN"]))

# ── Image storage ──────────────────────────────────────────────────────────────
_ALLOWED_IMG  = {"image/jpeg", "image/png", "image/webp"}
_MAX_IMG_SIZE = 5 * 1024 * 1024   # 5 MB

def _img_dir(subfolder: str) -> str:
    path = f"static/{subfolder}"
    os.makedirs(path, exist_ok=True)
    return path

async def _save_image(file: UploadFile, subfolder: str, record_id: str) -> str:
    """Validate, save and return the URL path for a vehicle image."""
    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(422, f"Unsupported file type '{file.content_type}'. Use JPEG, PNG, or WebP.")
    if file.size and file.size > _MAX_IMG_SIZE:
        raise HTTPException(413, "Image must be under 5 MB.")

    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    filename = f"{record_id}_{uuid.uuid4().hex[:10]}.{ext}"
    filepath = os.path.join(_img_dir(subfolder), filename)

    try:
        with open(filepath, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except OSError as exc:
        raise HTTPException(500, f"Failed to save image: {exc}") from exc

    return f"/static/{subfolder}/{filename}"


# ── Summary ────────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=FleetSummary)
async def get_fleet_summary(
    db: DB,
    _: User = ViewerDep,
):
    return await svc.get_fleet_summary(db)


# ── Trucks ─────────────────────────────────────────────────────────────────────

@router.get("/trucks", response_model=PaginatedResponse)
async def list_trucks(
    db: DB,
    _: User = ViewerDep,
    status: TruckStatus | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    query = select(Truck)

    if status:
        query = query.where(Truck.status == status)

    if search:
        term = f"%{search}%"
        query = query.where(
            Truck.plate_number.ilike(term) |
            Truck.make.ilike(term) |
            Truck.model.ilike(term)
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    trucks = result.scalars().all()

    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse(
        data=[TruckResponse.model_validate(t) for t in trucks],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next_page=page < total_pages,
            has_previous_page=page > 1,
        ),
    )


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


@router.post("/trucks/{truck_id}/image", response_model=TruckResponse)
async def upload_truck_image(
    truck_id: str,
    db: DB,
    file: UploadFile = File(...),
    _: User = AdminDep,
):
    """Upload or replace a truck's photo. Stored in static/trucks/."""
    truck = await db.get(Truck, truck_id)
    if not truck:
        raise HTTPException(404, "Truck not found.")

    # Remove old image if present
    if truck.image_url:
        old_path = truck.image_url.lstrip("/")
        if os.path.isfile(old_path):
            try: os.remove(old_path)
            except OSError: pass

    truck.image_url = await _save_image(file, "trucks", truck_id)
    await db.commit()
    await db.refresh(truck)
    return TruckResponse.model_validate(truck)


# ── Trailers ───────────────────────────────────────────────────────────────────

@router.get("/trailers", response_model=PaginatedResponse)
async def list_trailers(
    db: DB,
    _: User = ViewerDep,
    status: TrailerStatus | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    query = select(Trailer)

    if status:
        query = query.where(Trailer.status == status)

    if search:
        term = f"%{search}%"
        query = query.where(
            Trailer.plate_number.ilike(term) |
            Trailer.make.ilike(term) |
            Trailer.model.ilike(term)
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    trailers = result.scalars().all()

    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse(
        data=[TrailerResponse.model_validate(t) for t in trailers],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next_page=page < total_pages,
            has_previous_page=page > 1,
        ),
    )


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


@router.post("/trailers/{trailer_id}/image", response_model=TrailerResponse)
async def upload_trailer_image(
    trailer_id: str,
    db: DB,
    file: UploadFile = File(...),
    _: User = AdminDep,
):
    """Upload or replace a trailer's photo. Stored in static/trailers/."""
    trailer = await db.get(Trailer, trailer_id)
    if not trailer:
        raise HTTPException(404, "Trailer not found.")

    if trailer.image_url:
        old_path = trailer.image_url.lstrip("/")
        if os.path.isfile(old_path):
            try: os.remove(old_path)
            except OSError: pass

    trailer.image_url = await _save_image(file, "trailers", trailer_id)
    await db.commit()
    await db.refresh(trailer)
    return TrailerResponse.model_validate(trailer)