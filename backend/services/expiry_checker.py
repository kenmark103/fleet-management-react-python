"""
services/expiry_checker.py
Fleet Management System — Phase 9

Daily background task that scans for expiring documents and licences,
then fires notifications for anything expiring within the warning window
defined in SystemSettings.

Runs as an asyncio loop inside FastAPI's lifespan — no extra dependencies.
Fires once at startup (so you see results immediately on first deploy),
then every 24 hours after that.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.dbconfig import async_session
from db.models import (
    TruckDocument, TrailerDocument, DriverDocument,
    Truck, Trailer, Driver, SystemSettings,
)
from services.notification_service import notify_document_expiring

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

async def _get_warn_days(db: AsyncSession) -> int:
    """Read document_expiry_warning_days from SystemSettings, fallback 30."""
    result = await db.execute(select(SystemSettings).where(SystemSettings.id == "global"))
    settings = result.scalar_one_or_none()
    return settings.document_expiry_warning_days if settings else 30


async def _run_check() -> None:
    """
    One full scan of all document tables.
    Creates a fresh DB session — isolated from any request context.
    """
    async with async_session() as db:
        try:
            warn_days = await _get_warn_days(db)
            now       = datetime.now(timezone.utc)
            cutoff    = now + timedelta(days=warn_days)

            count = 0

            # ── Truck documents ──────────────────────────────────────────────
            result = await db.execute(
                select(TruckDocument).where(
                    TruckDocument.expiry_date != None,
                    TruckDocument.expiry_date <= cutoff,
                    TruckDocument.expiry_date >= now,   # not already expired
                )
            )
            truck_docs = result.scalars().all()

            for doc in truck_docs:
                truck = await db.get(Truck, doc.truck_id)
                label = f"{truck.make} {truck.plate_number} — {doc.type.title()}" if truck else f"Truck {doc.truck_id} — {doc.type}"
                await notify_document_expiring(
                    db,
                    entity_label=label,
                    entity_type="truck",
                    entity_id=doc.id,
                    expiry_date=doc.expiry_date,
                    action_url=f"/fleet/trucks/{doc.truck_id}",
                    warn_days=warn_days,
                )
                count += 1

            # ── Trailer documents ────────────────────────────────────────────
            result = await db.execute(
                select(TrailerDocument).where(
                    TrailerDocument.expiry_date != None,
                    TrailerDocument.expiry_date <= cutoff,
                    TrailerDocument.expiry_date >= now,
                )
            )
            trailer_docs = result.scalars().all()

            for doc in trailer_docs:
                trailer = await db.get(Trailer, doc.trailer_id)
                label = f"{trailer.make} {trailer.plate_number} — {doc.type.title()}" if trailer else f"Trailer {doc.trailer_id} — {doc.type}"
                await notify_document_expiring(
                    db,
                    entity_label=label,
                    entity_type="trailer",
                    entity_id=doc.id,
                    expiry_date=doc.expiry_date,
                    action_url=f"/fleet/trailers/{doc.trailer_id}",
                    warn_days=warn_days,
                )
                count += 1

            # ── Driver licences ──────────────────────────────────────────────
            result = await db.execute(
                select(Driver).where(
                    Driver.license_expiry_date != None,
                    Driver.license_expiry_date <= cutoff,
                    Driver.license_expiry_date >= now,
                )
            )
            drivers = result.scalars().all()

            for driver in drivers:
                label = f"{driver.first_name} {driver.last_name} — Driver Licence"
                await notify_document_expiring(
                    db,
                    entity_label=label,
                    entity_type="driver",
                    entity_id=driver.id,
                    expiry_date=driver.license_expiry_date,
                    action_url=f"/drivers/{driver.id}",
                    warn_days=warn_days,
                )
                count += 1

            # notify_document_expiring commits internally after each notification
            log.info(f"[expiry-checker] Scan complete — {count} expiring item(s) checked.")

        except Exception:
            log.exception("[expiry-checker] Error during daily expiry scan")
            # Don't re-raise — we don't want to crash the background loop


# ─────────────────────────────────────────────────────────────────────────────
# BACKGROUND LOOP  — called once from lifespan
# ─────────────────────────────────────────────────────────────────────────────

INTERVAL_HOURS = 24

async def daily_expiry_check_loop() -> None:
    """
    Runs forever: check immediately on startup, then every 24 hours.
    Designed to be launched as asyncio.create_task() inside FastAPI lifespan.
    """
    log.info("[expiry-checker] Daily expiry check task started.")
    while True:
        await _run_check()
        log.info(f"[expiry-checker] Next check in {INTERVAL_HOURS}h.")
        await asyncio.sleep(INTERVAL_HOURS * 3600)