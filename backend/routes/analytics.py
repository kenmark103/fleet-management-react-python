from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from auth.deps import require_roles
from db.dbconfig import DB
from db.models import Driver, Truck
from schemas.analytics import (
    AnalyticsRecomputeResponse,
    AnomalyEventResponse,
    DriverBehaviorEventResponse,
    DriverLeaderboardEntry,
    DriverLeaderboardResponse,
    DriverScorecardResponse,
    FleetHealthResponse,
    FleetHealthTruck,
    MaintenancePredictionResponse,
    TelemetrySnapshotCreate,
)
from schemas.common import ApiResponse
from services.analytics_service import (
    get_anomalies,
    get_driver_behavior_events,
    get_driver_leaderboard,
    get_driver_scorecard,
    get_fleet_health,
    get_predictions_for_truck,
    ingest_telemetry_snapshot,
    recompute_analytics,
)

router = APIRouter(prefix='/analytics', tags=['analytics'])


@router.get('/fleet-health', response_model=ApiResponse[FleetHealthResponse], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'FINANCE']))])
async def fleet_health(db: DB):
    rows, generated_at = await get_fleet_health(db)
    trucks = {t.id: t for t in (await db.execute(select(Truck))).scalars().all()}
    items = [
        FleetHealthTruck(
            truck_id=row.truck_id,
            plate_number=trucks[row.truck_id].plate_number if row.truck_id in trucks else row.truck_id,
            score=row.score,
            risk_level=row.risk_level,
            predicted_issue_type=row.predicted_issue_type,
            confidence=row.confidence,
            generated_at=row.generated_at,
        )
        for row in rows
    ]
    avg = round(sum(item.score for item in items) / len(items), 2) if items else 0.0
    return ApiResponse(data=FleetHealthResponse(
        fleet_average_score=avg,
        high_risk_count=sum(1 for item in items if item.risk_level == 'high'),
        generated_at=generated_at,
        trucks=items,
    ))


@router.get('/trucks/{truck_id}/predictions', response_model=ApiResponse[list[MaintenancePredictionResponse]], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'FINANCE']))])
async def truck_predictions(truck_id: str, db: DB):
    rows = await get_predictions_for_truck(db, truck_id)
    return ApiResponse(data=[MaintenancePredictionResponse.model_validate(row) for row in rows])


@router.get('/anomalies', response_model=ApiResponse[list[AnomalyEventResponse]], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'FINANCE']))])
async def anomalies(db: DB):
    rows = await get_anomalies(db)
    return ApiResponse(data=[AnomalyEventResponse.model_validate(row) for row in rows])


@router.post('/telemetry', response_model=ApiResponse[dict], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC']))])
async def create_telemetry(payload: TelemetrySnapshotCreate, db: DB):
    row = await ingest_telemetry_snapshot(db, payload.model_dump())
    return ApiResponse(data={'id': row.id}, message='Telemetry snapshot recorded')


@router.post('/recompute', response_model=ApiResponse[AnalyticsRecomputeResponse], dependencies=[Depends(require_roles(['ADMIN']))])
async def recompute(db: DB):
    result = await recompute_analytics(db)
    return ApiResponse(data=AnalyticsRecomputeResponse.model_validate(result), message='Analytics recomputed')


@router.get('/drivers/{driver_id}/scorecard', response_model=ApiResponse[DriverScorecardResponse], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'FINANCE', 'DRIVER']))])
async def driver_scorecard(driver_id: str, db: DB):
    row = await get_driver_scorecard(db, driver_id)
    if row is None:
        result = await recompute_analytics(db)
        row = await get_driver_scorecard(db, driver_id)
    return ApiResponse(data=DriverScorecardResponse.model_validate(row))


@router.get('/drivers/{driver_id}/behavior-events', response_model=ApiResponse[list[DriverBehaviorEventResponse]], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'FINANCE', 'DRIVER']))])
async def driver_behavior_events(driver_id: str, db: DB):
    rows = await get_driver_behavior_events(db, driver_id)
    return ApiResponse(data=[DriverBehaviorEventResponse.model_validate(row) for row in rows])


@router.get('/drivers/leaderboard', response_model=ApiResponse[DriverLeaderboardResponse], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'FINANCE']))])
async def driver_leaderboard(db: DB):
    rows = await get_driver_leaderboard(db)
    entries = [
        DriverLeaderboardEntry(
            driver_id=driver.id,
            driver_name=f'{driver.first_name} {driver.last_name}',
            total_score=card.total_score,
            safety_score=card.safety_score,
            efficiency_score=card.efficiency_score,
            punctuality_score=card.punctuality_score,
            generated_at=card.generated_at,
        )
        for driver, card in rows
    ]
    return ApiResponse(data=DriverLeaderboardResponse(entries=entries))
