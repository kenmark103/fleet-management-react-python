"""
services/geocoding.py
Fleet Management System — Phase 5

Thin async wrapper around Nominatim (OpenStreetMap).
Free, no API key required. Respects rate limits (1 req/s).
"""

import asyncio
import logging
from typing import Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Simple in-memory cache to avoid re-geocoding same address
_cache: dict[str, Tuple[float, float]] = {}


async def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Geocode an address string to (lat, lng) using Nominatim.
    Returns None if not found or on error.

    Rate limit: 1 request per second max (Nominatim policy)
    """
    if not address or not address.strip():
        return None

    # Check cache
    cache_key = address.strip().lower()
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        async with httpx.AsyncClient() as client:
            params = {
                "q": address,
                "format": "json",
                "limit": 1,
                "addressdetails": 0,
            }
            headers = {
                "User-Agent": "FleetMS/1.0 (fleet@example.com)"  # Required by Nominatim ToS
            }

            resp = await client.get(
                NOMINATIM_URL,
                params=params,
                headers=headers,
                timeout=10.0
            )
            resp.raise_for_status()
            data = resp.json()

            if not data:
                logger.warning(f"Geocoding returned no results for: {address}")
                return None

            lat = float(data[0]["lat"])
            lon = float(data[0]["lon"])

            # Cache result
            _cache[cache_key] = (lat, lon)
            return (lat, lon)

    except httpx.HTTPStatusError as e:
        logger.error(f"Geocoding HTTP error: {e.response.status_code} for address: {address}")
        return None
    except Exception as e:
        logger.error(f"Geocoding error: {e} for address: {address}")
        return None


async def maybe_geocode(
        address: str,
        existing_lat: Optional[float],
        existing_lng: Optional[float]
) -> Tuple[Optional[float], Optional[float]]:
    """
    Helper: only geocode if coords not provided.
    Returns (lat, lng) — either existing or newly geocoded.
    """
    if existing_lat is not None and existing_lng is not None:
        return (existing_lat, existing_lng)

    result = await geocode_address(address)
    if result:
        return result
    return (existing_lat, existing_lng)