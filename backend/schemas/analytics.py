from __future__ import annotations

from datetime import datetime
from typing import Optional

from schemas.common import CamelBase


class FleetHealthTruck(CamelBase):
    truck_id: str
    plate_number: str
    score: float
    risk_level: str
    predicted_issue_type: Optional[str] = None
    confidence: Optional[float] = None
    generated_at: datetime


class FleetHealthResponse(CamelBase):
    fleet_average_score: float
    high_risk_count: int
    generated_at: datetime
    trucks: list[FleetHealthTruck]


class MaintenancePredictionResponse(CamelBase):
    id: str
    truck_id: str
    recommended_action: str
    due_by_date: Optional[datetime] = None
    due_by_odometer: Optional[float] = None
    severity: str
    explanation: Optional[str] = None
    status: str
    generated_at: datetime


class AnomalyEventResponse(CamelBase):
    id: str
    entity_type: str
    entity_id: str
    metric_name: str
    observed_value: Optional[float] = None
    baseline_value: Optional[float] = None
    anomaly_score: Optional[float] = None
    severity: str
    summary: Optional[str] = None
    detected_at: datetime
    resolution_status: str


class TelemetrySnapshotCreate(CamelBase):
    truck_id: str
    recorded_at: datetime
    odometer_km: Optional[float] = None
    engine_temp_c: Optional[float] = None
    tire_pressure_avg: Optional[float] = None
    battery_voltage: Optional[float] = None
    fuel_rate: Optional[float] = None
    speed_avg: Optional[float] = None


class DriverBehaviorEventResponse(CamelBase):
    id: str
    driver_id: str
    trip_id: Optional[str] = None
    event_type: str
    severity: str
    measured_value: Optional[float] = None
    threshold: Optional[float] = None
    notes: Optional[str] = None
    occurred_at: datetime


class DriverScorecardResponse(CamelBase):
    id: str
    driver_id: str
    score_period_start: datetime
    score_period_end: datetime
    safety_score: float
    efficiency_score: float
    punctuality_score: float
    total_score: float
    summary: Optional[str] = None
    generated_at: datetime


class CoachingRecommendationResponse(CamelBase):
    id: str
    driver_id: str
    recommendation_type: str
    reason: str
    suggested_action: str
    generated_at: datetime
    acknowledged_at: Optional[datetime] = None


class DriverLeaderboardEntry(CamelBase):
    driver_id: str
    driver_name: str
    total_score: float
    safety_score: float
    efficiency_score: float
    punctuality_score: float
    generated_at: datetime


class DriverLeaderboardResponse(CamelBase):
    entries: list[DriverLeaderboardEntry]
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class AnalyticsRecomputeResponse(CamelBase):
    generated_at: datetime
    health_scores_created: int
    predictions_created: int
    anomalies_created: int
    scorecards_created: int
    behavior_events_created: int
