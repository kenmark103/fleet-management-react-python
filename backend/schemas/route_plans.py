from __future__ import annotations

from datetime import datetime
from typing import Optional

from schemas.common import CamelBase


class RouteAlternativeResponse(CamelBase):
    id: str
    label: str
    geometry_ref: Optional[str] = None
    distance_km: Optional[float] = None
    duration_secs: Optional[float] = None
    fuel_estimate: Optional[float] = None
    rank: int
    notes: Optional[str] = None


class RoutePlanResponse(CamelBase):
    id: str
    trip_id: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    route_geometry_ref: Optional[str] = None
    distance_km: Optional[float] = None
    duration_secs: Optional[float] = None
    eta_at: Optional[datetime] = None
    optimization_source: str
    score: Optional[float] = None
    generated_at: datetime
    alternatives: list[RouteAlternativeResponse] = []


class RouteOptimizeQueryResponse(CamelBase):
    primary: RoutePlanResponse


class RoutePlanRecomputeResponse(CamelBase):
    trip_id: str
    generated_at: datetime
    route_plan: RoutePlanResponse
