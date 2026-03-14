"""
routers/vehicles.py
Fleet Management System

Serves make / model catalog data from the static vehicle_data.json.
Useful for any future API-driven picker (mobile app, external integrations).
The frontend forms bundle the JSON directly at build time so they don't
need to call this endpoint — it's here for completeness and future use.

Routes
------
GET /api/v1/vehicles/makes?type=truck         → list of make names
GET /api/v1/vehicles/makes?type=trailer       → list of make names
GET /api/v1/vehicles/models?type=truck&make=Volvo
GET /api/v1/vehicles/models?type=trailer&make=Afrit
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# Resolve path relative to this file so it works regardless of CWD
_DATA_PATH = Path(__file__).parent.parent / "data" / "vehicle_data.json"


@lru_cache(maxsize=1)
def _load_catalog() -> dict:
    """Load and cache the JSON catalog on first request."""
    with _DATA_PATH.open() as fh:
        return json.load(fh)


VehicleType = Literal["truck", "trailer"]


def _catalog_key(vtype: VehicleType) -> str:
    return "trucks" if vtype == "truck" else "trailers"


# ── Makes ─────────────────────────────────────────────────────────────────────

@router.get("/makes")
async def list_makes(
    type: VehicleType = Query("truck", description="'truck' or 'trailer'"),
):
    """Return a sorted list of make names for the requested vehicle type."""
    catalog = _load_catalog()
    makes = sorted(item["make"] for item in catalog[_catalog_key(type)])
    return makes


# ── Models ────────────────────────────────────────────────────────────────────

@router.get("/models")
async def list_models(
    make: str = Query(..., description="Make name — must match catalog exactly"),
    type: VehicleType = Query("truck", description="'truck' or 'trailer'"),
):
    """
    Return all catalog models for a given make, including spec fields.

    Trucks   → [{model, wheelConfig, grossWeightTons, axleLoadTons}, ...]
    Trailers → [{model, type, capacityTons, axles}, ...]
    """
    catalog = _load_catalog()
    for item in catalog[_catalog_key(type)]:
        if item["make"] == make:
            return item["models"]
    raise HTTPException(
        status_code=404,
        detail=f"Make '{make}' not found in {type} catalog.",
    )