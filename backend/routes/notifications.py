"""
routes/notifications.py
Fleet Management System — Phase 9

Endpoints:
  GET   /notifications               → paginated list for current user
  GET   /notifications/unread-count  → badge count (must be before /{id})
  PATCH /notifications/{id}/read     → mark single as read/unread
  PATCH /notifications/read-all      → mark all as read
  DELETE /notifications/{id}         → delete single
"""

from __future__ import annotations

from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.dbconfig import DB
from db.models import Notification, User
from schemas.common import PaginatedResponse, PaginationMeta, ApiResponse
from schemas.notifications import NotificationResponse, NotificationMarkRead, UnreadCountResponse
from auth.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])
CurrentUser = Annotated[User, Depends(get_current_user)]


def _meta(page: int, page_size: int, total: int) -> PaginationMeta:
    total_pages = max(1, -(-total // page_size))
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=total_pages,
        has_next_page=page < total_pages,
        has_previous_page=page > 1,
    )


# ─────────────────────────────────────────────────────────────────────────────
# UNREAD COUNT  (must be before /{id} route)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/unread-count", response_model=ApiResponse[UnreadCountResponse])
async def get_unread_count(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    count = result.scalar_one()
    return ApiResponse(data=UnreadCountResponse(count=count))


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[NotificationResponse])
async def list_notifications(
    db:          DB,
    current_user: CurrentUser,
    page:         int           = Query(1, ge=1),
    page_size:    int           = Query(20, ge=1, le=100),
    unread_only:  bool          = Query(False),
    type_filter:  Optional[str] = Query(None, alias="type"),
):
    filters = [Notification.user_id == current_user.id]
    if unread_only:
        filters.append(Notification.is_read == False)
    if type_filter:
        filters.append(Notification.type == type_filter)

    base_q = select(Notification).where(*filters)
    total  = (await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )).scalar_one()

    offset = (page - 1) * page_size
    rows   = (await db.execute(
        base_q.order_by(Notification.created_at.desc())
              .offset(offset).limit(page_size)
    )).scalars().all()

    return PaginatedResponse[NotificationResponse](
        data=[NotificationResponse.from_orm_row(n) for n in rows],
        meta=_meta(page, page_size, total),
        success=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MARK SINGLE READ/UNREAD
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{notification_id}/read", response_model=ApiResponse[NotificationResponse])
async def mark_notification_read(
    notification_id: str,
    payload:         NotificationMarkRead,
    db:              DB,
    current_user:    CurrentUser,
):
    n = await db.get(Notification, notification_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = payload.isRead
    await db.commit()
    await db.refresh(n)

    return ApiResponse(
        data=NotificationResponse.from_orm_row(n),
        message="Notification updated",
    )


# ─────────────────────────────────────────────────────────────────────────────
# MARK ALL READ
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/read-all", response_model=ApiResponse[dict])
async def mark_all_read(db: DB, current_user: CurrentUser):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return ApiResponse(data={}, message="All notifications marked as read")


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{notification_id}", response_model=ApiResponse[dict])
async def delete_notification(
    notification_id: str,
    db:              DB,
    current_user:    CurrentUser,
):
    n = await db.get(Notification, notification_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(n)
    await db.commit()
    return ApiResponse(data={"id": notification_id}, message="Notification deleted")