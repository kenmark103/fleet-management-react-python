"""
services/notification_service.py
Fleet Management System — Phase 9

Helper functions for creating notifications.
Import and call from existing route handlers — see integration notes at bottom.

Usage pattern (in any route handler):
    from services.notification_service import notify_trip_assigned
    await notify_trip_assigned(db, trip, driver_user_id)
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Notification, User, Driver, Truck, Trip, WorkOrder

# ── Email (uncomment when ready to send emails in production) ─────────────────
# from services.email import (
#     send_work_order_assigned,
#     send_document_expiry,
# )


# ─────────────────────────────────────────────────────────────────────────────
# CORE CREATE HELPER
# ─────────────────────────────────────────────────────────────────────────────

async def _create(
    db: AsyncSession,
    *,
    user_id:     str,
    type_:       str,
    title:       str,
    message:     str,
    entity_type: str | None = None,
    entity_id:   str | None = None,
    action_url:  str | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        action_url=action_url,
    )
    db.add(n)
    # Intentionally NOT committing here — caller commits as part of their own transaction
    return n


# ─────────────────────────────────────────────────────────────────────────────
# TRIPS
# ─────────────────────────────────────────────────────────────────────────────

async def notify_trip_assigned(db: AsyncSession, trip: Trip) -> None:
    """
    Call after creating or updating a trip when assigned_driver_id is set.
    Notifies the assigned driver's user account.
    """
    if not trip.assigned_driver_id:
        return

    driver = await db.get(Driver, trip.assigned_driver_id)
    if not driver:
        return

    await _create(
        db,
        user_id=driver.user_id,
        type_="trip_assigned",
        title="New trip assigned",
        message=f"You have been assigned trip {trip.trip_number}: {trip.origin} → {trip.destination} "
                f"departing {trip.scheduled_departure.strftime('%d %b %Y %H:%M')}.",
        entity_type="trip",
        entity_id=trip.id,
        action_url=f"/trips/{trip.id}",
    )


async def notify_trip_status_changed(
    db: AsyncSession,
    trip: Trip,
    old_status: str,
    changed_by_user_id: str,
) -> None:
    """
    Notify DISPATCHER / ADMIN when a DRIVER changes trip status.
    Notify the DRIVER when dispatcher updates their trip.
    """
    # Find dispatchers and admins to notify
    result = await db.execute(
        select(User).where(
            User.role.in_(["ADMIN", "DISPATCHER"]),
            User.is_active == True,
            User.id != changed_by_user_id,
        )
    )
    supervisors = result.scalars().all()

    status_label = trip.status.replace("-", " ").title()

    for sup in supervisors:
        await _create(
            db,
            user_id=sup.id,
            type_="trip_status_changed",
            title=f"Trip {trip.trip_number} status updated",
            message=f"Trip {trip.trip_number} ({trip.origin} → {trip.destination}) "
                    f"changed from '{old_status}' to '{status_label}'.",
            entity_type="trip",
            entity_id=trip.id,
            action_url=f"/trips/{trip.id}",
        )

    # Also notify the driver if a dispatcher/admin changed their trip
    if trip.assigned_driver_id:
        driver = await db.get(Driver, trip.assigned_driver_id)
        if driver and driver.user_id != changed_by_user_id:
            await _create(
                db,
                user_id=driver.user_id,
                type_="trip_status_changed",
                title=f"Your trip status updated to {status_label}",
                message=f"Trip {trip.trip_number} ({trip.origin} → {trip.destination}) "
                        f"has been updated to '{status_label}'.",
                entity_type="trip",
                entity_id=trip.id,
                action_url=f"/trips/{trip.id}",
            )


# ─────────────────────────────────────────────────────────────────────────────
# MAINTENANCE
# ─────────────────────────────────────────────────────────────────────────────

async def notify_work_order_assigned(db: AsyncSession, work_order: WorkOrder) -> None:
    """Call after creating a work order. Notifies the assigned mechanic."""

    mechanic = await db.get(User, work_order.assigned_mechanic_id)
    if not mechanic:
        return

    truck = await db.get(Truck, work_order.truck_id)
    truck_label = truck.plate_number if truck else work_order.truck_id

    await _create(
        db,
        user_id=mechanic.id,
        type_="work_order_assigned",
        title=f"Work order assigned: {work_order.work_order_number}",
        message=f"You have been assigned work order {work_order.work_order_number} "
                f"for {truck_label}: {work_order.title}. "
                f"Priority: {work_order.priority.upper()}.",
        entity_type="work_order",
        entity_id=work_order.id,
        action_url=f"/maintenance/work-orders/{work_order.id}",
    )

    # ── Email notification (uncomment when ready) ─────────────────────────────
    # import os
    # await send_work_order_assigned(
    #     to             = mechanic.email,
    #     mechanic_name  = f"{mechanic.first_name} {mechanic.last_name}",
    #     wo_number      = work_order.work_order_number,
    #     wo_title       = work_order.title,
    #     truck_plate    = truck_label,
    #     priority       = work_order.priority,
    #     scheduled_date = work_order.scheduled_date.strftime("%d %b %Y"),
    #     wo_url         = f"{os.getenv('FRONTEND_URL', '')}/maintenance/work-orders/{work_order.id}",
    # )


# ─────────────────────────────────────────────────────────────────────────────
# FUEL / EXPENSES
# ─────────────────────────────────────────────────────────────────────────────

async def notify_fuel_logged(db: AsyncSession, fuel_log_id: str, truck_id: str, total_cost: float) -> None:
    """Notify FINANCE and ADMIN when a fuel log is submitted."""
    truck = await db.get(Truck, truck_id)
    truck_label = truck.plate_number if truck else truck_id

    result = await db.execute(
        select(User).where(User.role.in_(["ADMIN", "FINANCE"]), User.is_active == True)
    )
    recipients = result.scalars().all()

    for user in recipients:
        await _create(
            db,
            user_id=user.id,
            type_="fuel_logged",
            title="Fuel log submitted",
            message=f"A fuel log has been submitted for {truck_label} — total cost ${total_cost:,.2f}.",
            entity_type="fuel_log",
            entity_id=fuel_log_id,
            action_url="/fuel",
        )


async def notify_expense_submitted(
    db: AsyncSession, expense_id: str, category: str, amount: float, currency: str
) -> None:
    """Notify FINANCE and ADMIN when an expense is submitted."""
    result = await db.execute(
        select(User).where(User.role.in_(["ADMIN", "FINANCE"]), User.is_active == True)
    )
    recipients = result.scalars().all()

    for user in recipients:
        await _create(
            db,
            user_id=user.id,
            type_="expense_submitted",
            title="New expense submitted",
            message=f"A {category} expense of {currency} {amount:,.2f} has been submitted.",
            entity_type="expense",
            entity_id=expense_id,
            action_url="/fuel",
        )


# ─────────────────────────────────────────────────────────────────────────────
# EXPIRY / DOCUMENT ALERTS  (run as background task / scheduled job)
# ─────────────────────────────────────────────────────────────────────────────

async def notify_document_expiring(
    db: AsyncSession,
    *,
    entity_label: str,       # e.g. "KCA 001X Insurance"
    entity_type: str,         # "truck" | "driver"
    entity_id: str,
    expiry_date: datetime,
    action_url: str,
    warn_days: int = 30,
) -> None:
    """
    Notify ADMIN and DISPATCHER when a document is expiring within warn_days.
    De-duplicates: won't create a new notification if one already exists
    for the same entity_id and type within the last 7 days.
    """
    # De-dup check
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    existing = await db.execute(
        select(Notification).where(
            Notification.entity_id == entity_id,
            Notification.type == "document_expiring",
            Notification.created_at >= cutoff,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already notified recently

    days_left = (expiry_date.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days

    result = await db.execute(
        select(User).where(User.role.in_(["ADMIN", "DISPATCHER"]), User.is_active == True)
    )
    recipients = result.scalars().all()

    for user in recipients:
        await _create(
            db,
            user_id=user.id,
            type_="document_expiring",
            title=f"Document expiring in {days_left} days",
            message=f"{entity_label} expires on {expiry_date.strftime('%d %b %Y')} ({days_left} days remaining).",
            entity_type=entity_type,
            entity_id=entity_id,
            action_url=action_url,
        )
    await db.commit()

    # ── Email notification (uncomment when ready) ─────────────────────────────
    # recipient_emails = [u.email for u in recipients]
    # if recipient_emails:
    #     await send_document_expiry(
    #         to           = recipient_emails,
    #         entity_label = entity_label,
    #         expiry_date  = expiry_date.strftime("%d %b %Y"),
    #         days_left    = days_left,
    #         action_url   = f"{os.getenv('FRONTEND_URL', '')}{action_url}",
    #     )


# ─────────────────────────────────────────────────────────────────────────────
# INTEGRATION NOTES
# ─────────────────────────────────────────────────────────────────────────────
#
# routes/trips.py — add these calls:
#
#   In create_trip(), AFTER await db.commit():
#     from services.notification_service import notify_trip_assigned
#     await notify_trip_assigned(db, trip)
#     await db.commit()
#
#   In update_trip_status(), AFTER trip.status = data.status, BEFORE commit:
#     from services.notification_service import notify_trip_status_changed
#     await notify_trip_status_changed(db, trip, old_status, current_user.id)
#
# routes/maintenance.py — add in create_work_order(), AFTER await db.commit():
#     from services.notification_service import notify_work_order_assigned
#     await notify_work_order_assigned(db, wo)
#     await db.commit()
#
# routes/fuel.py — add in create_fuel_log(), AFTER await db.commit():
#     from services.notification_service import notify_fuel_logged
#     await notify_fuel_logged(db, log.id, log.truck_id, log.total_cost)
#     await db.commit()
#
# For document expiry alerts, run notify_document_expiring() as a daily
# background task (e.g. APScheduler or FastAPI lifespan task) that queries
# truck_documents and driver_documents with expiry_date within 30 days.