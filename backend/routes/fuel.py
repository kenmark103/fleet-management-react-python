"""
routers/fuel.py
Fleet Management System — Phase 6

Auth pattern:
  - CurrentUser = Annotated[User, Depends(get_current_user)]
  - require_roles(["ADMIN", "FINANCE"]) returns a dependency — used with Depends()
  - No separate require_roles() call inside the function body
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from db.dbconfig import DB
from db.models import FuelLog, Expense, Driver, User
from schemas.common import PaginatedResponse, PaginationMeta, ApiResponse
from schemas.fuel import (
    FuelLogCreate, FuelLogUpdate, FuelLogResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse,
    FuelReportResponse,
)
from services.fuel_service import (
    auto_total_cost,
    resolve_fuel_log,
    resolve_expense,
    get_report_data,
    generate_fuel_logs_csv,
)
from services.notification_service import notify_fuel_logged, notify_expense_submitted
from auth.deps import get_current_user, require_roles

router = APIRouter(prefix="/fuel", tags=["Fuel & Costs"])
CurrentUser = Annotated[User, Depends(get_current_user)]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _pagination_meta(page: int, page_size: int, total: int) -> PaginationMeta:
    total_pages = max(1, -(-total // page_size))  # ceiling division
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=total_pages,
        has_next_page=page < total_pages,
        has_previous_page=page > 1,
    )


async def _resolve_driver_id_for_user(user: User, db: DB) -> str | None:
    """
    Given a User ORM instance, returns the matching Driver.id.
    Returns None if the user has no driver profile.
    Used to enforce DRIVER ownership on fuel logs.
    """
    row = await db.execute(select(Driver).where(Driver.user_id == user.id))
    driver = row.scalar_one_or_none()
    return driver.id if driver else None


# ─────────────────────────────────────────────────────────────────────────────
# FUEL LOGS
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/logs",
    response_model=PaginatedResponse[FuelLogResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE", "DRIVER"]))],
)
async def list_fuel_logs(
    db:           DB,
    current_user: CurrentUser,
    page:         int               = Query(1, ge=1),
    page_size:    int               = Query(20, ge=1, le=100),
    truck_id:     Optional[str]     = Query(None),
    driver_id:    Optional[str]     = Query(None),
    trip_id:      Optional[str]     = Query(None),
    date_from:    Optional[datetime] = Query(None),
    date_to:      Optional[datetime] = Query(None),
):
    filters = []

    # DRIVER sees only their own logs — ignore any driver_id query param
    if current_user.role == "DRIVER":
        own_driver_id = await _resolve_driver_id_for_user(current_user, db)
        if not own_driver_id:
            return PaginatedResponse[FuelLogResponse](
                data=[], meta=_pagination_meta(page, page_size, 0), success=True
            )
        filters.append(FuelLog.driver_id == own_driver_id)
    else:
        # ADMIN / FINANCE — optional driver filter
        if driver_id:
            filters.append(FuelLog.driver_id == driver_id)

    if truck_id:
        filters.append(FuelLog.truck_id == truck_id)
    if trip_id:
        filters.append(FuelLog.trip_id == trip_id)
    if date_from:
        filters.append(FuelLog.logged_at >= date_from)
    if date_to:
        filters.append(FuelLog.logged_at <= date_to)

    base_q = select(FuelLog).where(*filters)

    # Total count
    all_rows = (await db.execute(base_q)).scalars().all()
    total    = len(all_rows)

    # Paginated page
    offset = (page - 1) * page_size
    rows   = (
        await db.execute(
            base_q.order_by(FuelLog.logged_at.desc())
                  .offset(offset)
                  .limit(page_size)
        )
    ).scalars().all()

    data = []
    for log in rows:
        resolved = await resolve_fuel_log(log, db)
        data.append(FuelLogResponse.model_validate({**log.__dict__, **resolved}))

    return PaginatedResponse[FuelLogResponse](
        data=data,
        meta=_pagination_meta(page, page_size, total),
        success=True,
    )


@router.post(
    "/logs",
    response_model=ApiResponse[FuelLogResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN", "DRIVER"]))],
)
async def create_fuel_log(
    payload:      FuelLogCreate,
    db:           DB,
    current_user: CurrentUser,
):
    # DRIVER can only log fuel for their own driver profile
    if current_user.role == "DRIVER":
        own_driver_id = await _resolve_driver_id_for_user(current_user, db)
        if not own_driver_id or own_driver_id != payload.driver_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Drivers can only log fuel for their own profile.",
            )

    total_cost = auto_total_cost(payload.litres, payload.price_per_litre)

    log = FuelLog(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
        total_cost=total_cost,
    )
    db.add(log)
    await notify_fuel_logged(db, log.id, log.truck_id, log.total_cost)
    await db.commit()
    await db.refresh(log)

    resolved = await resolve_fuel_log(log, db)
    return ApiResponse[FuelLogResponse](
        data=FuelLogResponse.model_validate({**log.__dict__, **resolved}),
        message="Fuel log created.",
    )


@router.get(
    "/logs/{log_id}",
    response_model=ApiResponse[FuelLogResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE", "DRIVER"]))],
)
async def get_fuel_log(log_id: str, db: DB, current_user: CurrentUser):
    log = await db.get(FuelLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Fuel log not found.")

    # DRIVER ownership check
    if current_user.role == "DRIVER":
        own_driver_id = await _resolve_driver_id_for_user(current_user, db)
        if log.driver_id != own_driver_id:
            raise HTTPException(status_code=403, detail="Access denied.")

    resolved = await resolve_fuel_log(log, db)
    return ApiResponse[FuelLogResponse](
        data=FuelLogResponse.model_validate({**log.__dict__, **resolved})
    )


@router.patch(
    "/logs/{log_id}",
    response_model=ApiResponse[FuelLogResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def update_fuel_log(
    log_id:  str,
    payload: FuelLogUpdate,
    db:      DB,
    current_user: CurrentUser,
):
    log = await db.get(FuelLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Fuel log not found.")

    update_data = payload.model_dump(exclude_unset=True)

    # Recompute total_cost if litres or price_per_litre changed
    new_litres = update_data.get("litres", log.litres)
    new_price  = update_data.get("price_per_litre", log.price_per_litre)
    if "litres" in update_data or "price_per_litre" in update_data:
        update_data["total_cost"] = auto_total_cost(new_litres, new_price)

    for field, value in update_data.items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)

    resolved = await resolve_fuel_log(log, db)
    return ApiResponse[FuelLogResponse](
        data=FuelLogResponse.model_validate({**log.__dict__, **resolved}),
        message="Fuel log updated.",
    )


@router.delete(
    "/logs/{log_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_fuel_log(log_id: str, db: DB):
    log = await db.get(FuelLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Fuel log not found.")

    await db.delete(log)
    await db.commit()
    return ApiResponse[dict](data={}, message="Fuel log deleted.")


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/expenses",
    response_model=PaginatedResponse[ExpenseResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def list_expenses(
    db:        DB,
    current_user: CurrentUser,
    page:      int               = Query(1, ge=1),
    page_size: int               = Query(20, ge=1, le=100),
    category:  Optional[str]     = Query(None),
    truck_id:  Optional[str]     = Query(None),
    driver_id: Optional[str]     = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to:   Optional[datetime] = Query(None),
):
    filters = []
    if category:
        filters.append(Expense.category == category)
    if truck_id:
        filters.append(Expense.truck_id == truck_id)
    if driver_id:
        filters.append(Expense.driver_id == driver_id)
    if date_from:
        filters.append(Expense.expense_date >= date_from)
    if date_to:
        filters.append(Expense.expense_date <= date_to)

    base_q   = select(Expense).where(*filters)
    all_rows = (await db.execute(base_q)).scalars().all()
    total    = len(all_rows)

    offset = (page - 1) * page_size
    rows   = (
        await db.execute(
            base_q.order_by(Expense.expense_date.desc())
                  .offset(offset)
                  .limit(page_size)
        )
    ).scalars().all()

    data = []
    for expense in rows:
        resolved = await resolve_expense(expense, db)
        data.append(ExpenseResponse.model_validate({**expense.__dict__, **resolved}))

    return PaginatedResponse[ExpenseResponse](
        data=data,
        meta=_pagination_meta(page, page_size, total),
        success=True,
    )


@router.post(
    "/expenses",
    response_model=ApiResponse[ExpenseResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def create_expense(
    payload:      ExpenseCreate,
    db:           DB,
    current_user: CurrentUser,
):
    expense = Expense(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(expense)
    await notify_expense_submitted(db, expense.id, expense.category, expense.amount, expense.currency)
    await db.commit()
    await db.refresh(expense)

    resolved = await resolve_expense(expense, db)
    return ApiResponse[ExpenseResponse](
        data=ExpenseResponse.model_validate({**expense.__dict__, **resolved}),
        message="Expense created.",
    )


@router.get(
    "/expenses/{expense_id}",
    response_model=ApiResponse[ExpenseResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def get_expense(expense_id: str, db: DB):
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    resolved = await resolve_expense(expense, db)
    return ApiResponse[ExpenseResponse](
        data=ExpenseResponse.model_validate({**expense.__dict__, **resolved})
    )


@router.patch(
    "/expenses/{expense_id}",
    response_model=ApiResponse[ExpenseResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def update_expense(
    expense_id: str,
    payload:    ExpenseUpdate,
    db:         DB,
):
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)

    await db.commit()
    await db.refresh(expense)

    resolved = await resolve_expense(expense, db)
    return ApiResponse[ExpenseResponse](
        data=ExpenseResponse.model_validate({**expense.__dict__, **resolved}),
        message="Expense updated.",
    )


@router.delete(
    "/expenses/{expense_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_roles(["ADMIN"]))],
)
async def delete_expense(expense_id: str, db: DB):
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    await db.delete(expense)
    await db.commit()
    return ApiResponse[dict](data={}, message="Expense deleted.")


# ─────────────────────────────────────────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/reports",
    response_model=ApiResponse[FuelReportResponse],
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def get_fuel_reports(
    db:        DB,
    currency:  str               = Query("USD", max_length=3),
    date_from: Optional[datetime] = Query(None),
    date_to:   Optional[datetime] = Query(None),
):
    report = await get_report_data(
        db=db,
        currency=currency,
        date_from=date_from,
        date_to=date_to,
    )
    return ApiResponse[FuelReportResponse](data=report)


@router.get(
    "/reports/export",
    dependencies=[Depends(require_roles(["ADMIN", "FINANCE"]))],
)
async def export_fuel_logs_csv(
    db:        DB,
    truck_id:  Optional[str]      = Query(None),
    driver_id: Optional[str]      = Query(None),
    trip_id:   Optional[str]      = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to:   Optional[datetime] = Query(None),
):
    """Streams a CSV of the current filtered fuel-log view."""
    filters = []
    if truck_id:
        filters.append(FuelLog.truck_id == truck_id)
    if driver_id:
        filters.append(FuelLog.driver_id == driver_id)
    if trip_id:
        filters.append(FuelLog.trip_id == trip_id)
    if date_from:
        filters.append(FuelLog.logged_at >= date_from)
    if date_to:
        filters.append(FuelLog.logged_at <= date_to)

    rows = (
        await db.execute(
            select(FuelLog).where(*filters).order_by(FuelLog.logged_at.desc())
        )
    ).scalars().all()

    resolved    = [await resolve_fuel_log(log, db) for log in rows]
    csv_content = generate_fuel_logs_csv(list(rows), resolved)

    filename = f"fuel_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )