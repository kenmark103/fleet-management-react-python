from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    AnomalyEvent,
    CoachingRecommendation,
    Driver,
    DriverBehaviorEvent,
    DriverScorecard,
    FuelLog,
    MaintenancePrediction,
    ServiceRecord,
    ServiceSchedule,
    Trip,
    TripLocationPing,
    Truck,
    VehicleHealthScore,
    VehicleTelemetrySnapshot,
    WorkOrder,
    Incident,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _risk_level(score: float) -> str:
    if score < 50:
        return "high"
    if score < 75:
        return "medium"
    return "low"


async def ingest_telemetry_snapshot(db: AsyncSession, payload: dict) -> VehicleTelemetrySnapshot:
    snapshot = VehicleTelemetrySnapshot(**payload)
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    return snapshot


async def recompute_analytics(db: AsyncSession) -> dict:
    now = _utcnow()
    period_start = now - timedelta(days=30)

    trucks = (await db.execute(select(Truck).order_by(Truck.plate_number))).scalars().all()
    drivers = (await db.execute(select(Driver).order_by(Driver.last_name, Driver.first_name))).scalars().all()
    fuel_logs = (await db.execute(select(FuelLog).where(FuelLog.logged_at >= period_start))).scalars().all()
    service_records = (await db.execute(select(ServiceRecord).where(ServiceRecord.service_date >= period_start))).scalars().all()
    work_orders = (await db.execute(select(WorkOrder).where(WorkOrder.created_at >= period_start))).scalars().all()
    schedules = (await db.execute(select(ServiceSchedule))).scalars().all()
    trips = (await db.execute(select(Trip).where(Trip.scheduled_departure >= period_start))).scalars().all()
    pings = (await db.execute(select(TripLocationPing).where(TripLocationPing.recorded_at >= period_start))).scalars().all()
    incidents = (await db.execute(select(Incident).where(Incident.incident_date >= period_start))).scalars().all()

    await db.execute(delete(VehicleHealthScore))
    await db.execute(delete(MaintenancePrediction))
    await db.execute(delete(AnomalyEvent))
    await db.execute(delete(DriverBehaviorEvent))
    await db.execute(delete(DriverScorecard))
    await db.execute(delete(CoachingRecommendation))
    await db.commit()

    health_scores_created = 0
    predictions_created = 0
    anomalies_created = 0
    behavior_events_created = 0
    scorecards_created = 0

    fuel_by_truck: dict[str, list[FuelLog]] = defaultdict(list)
    for log in fuel_logs:
        fuel_by_truck[log.truck_id].append(log)

    records_by_truck: dict[str, list[ServiceRecord]] = defaultdict(list)
    for record in service_records:
        records_by_truck[record.truck_id].append(record)

    schedules_by_truck: dict[str, list[ServiceSchedule]] = defaultdict(list)
    for schedule in schedules:
        schedules_by_truck[schedule.truck_id].append(schedule)

    telemetry_by_truck: dict[str, list[VehicleTelemetrySnapshot]] = defaultdict(list)
    telemetry_rows = (await db.execute(select(VehicleTelemetrySnapshot).where(VehicleTelemetrySnapshot.recorded_at >= period_start))).scalars().all()
    for snapshot in telemetry_rows:
        telemetry_by_truck[snapshot.truck_id].append(snapshot)

    for truck in trucks:
        score = 100.0
        issue_parts: list[str] = []
        fuel_entries = fuel_by_truck.get(truck.id, [])
        truck_records = records_by_truck.get(truck.id, [])
        truck_schedules = schedules_by_truck.get(truck.id, [])
        telemetry = telemetry_by_truck.get(truck.id, [])

        avg_cost = mean([x.total_cost for x in fuel_entries]) if fuel_entries else 0.0
        if len(fuel_entries) >= 3 and avg_cost > 300:
            score -= 20
            issue_parts.append("fuel inefficiency")
            db.add(AnomalyEvent(
                entity_type="truck",
                entity_id=truck.id,
                metric_name="fuel_cost_per_fill",
                observed_value=avg_cost,
                baseline_value=250.0,
                anomaly_score=min(avg_cost / 250.0, 5.0),
                severity="medium",
                summary=f"Average fuel fill cost for {truck.plate_number} is elevated.",
                detected_at=now,
                resolution_status="open",
            ))
            anomalies_created += 1

        if len(truck_records) >= 2:
            recent_cost = sum(r.cost for r in truck_records)
            if recent_cost > 1500:
                score -= 18
                issue_parts.append("maintenance frequency")
                db.add(AnomalyEvent(
                    entity_type="truck",
                    entity_id=truck.id,
                    metric_name="maintenance_cost_30d",
                    observed_value=recent_cost,
                    baseline_value=1000.0,
                    anomaly_score=min(recent_cost / 1000.0, 5.0),
                    severity="high",
                    summary=f"Maintenance spend for {truck.plate_number} is unusually high this month.",
                    detected_at=now,
                    resolution_status="open",
                ))
                anomalies_created += 1

        overdue_schedule = next((s for s in truck_schedules if s.next_service_date and s.next_service_date < now), None)
        if overdue_schedule:
            score -= 25
            issue_parts.append("overdue service")
            db.add(MaintenancePrediction(
                truck_id=truck.id,
                source_window_start=period_start,
                source_window_end=now,
                recommended_action=f"Schedule {overdue_schedule.service_type}",
                due_by_date=overdue_schedule.next_service_date,
                due_by_odometer=overdue_schedule.next_service_odometer,
                severity="high",
                explanation=f"{truck.plate_number} is past its planned {overdue_schedule.service_type} date.",
                status="open",
                generated_at=now,
            ))
            predictions_created += 1

        if telemetry:
            latest = sorted(telemetry, key=lambda t: t.recorded_at)[-1]
            if latest.engine_temp_c and latest.engine_temp_c > 105:
                score -= 15
                issue_parts.append("engine heat")
            if latest.battery_voltage and latest.battery_voltage < 11.8:
                score -= 8
                issue_parts.append("battery")
            if latest.tire_pressure_avg and latest.tire_pressure_avg < 28:
                score -= 8
                issue_parts.append("tire pressure")

        score = max(10.0, round(score, 2))
        health = VehicleHealthScore(
            truck_id=truck.id,
            score=score,
            risk_level=_risk_level(score),
            predicted_issue_type=", ".join(issue_parts[:2]) if issue_parts else None,
            confidence=0.72 if issue_parts else 0.55,
            details={"signals": issue_parts},
            generated_at=now,
        )
        db.add(health)
        health_scores_created += 1

        if score < 70 and not overdue_schedule:
            db.add(MaintenancePrediction(
                truck_id=truck.id,
                source_window_start=period_start,
                source_window_end=now,
                recommended_action="Inspect vehicle health indicators",
                due_by_date=now + timedelta(days=7),
                due_by_odometer=(truck.odometer_km or 0) + 500,
                severity="medium" if score >= 50 else "high",
                explanation=f"{truck.plate_number} health score dropped to {score}.",
                status="open",
                generated_at=now,
            ))
            predictions_created += 1

    pings_by_trip: dict[str, list[TripLocationPing]] = defaultdict(list)
    for ping in pings:
        pings_by_trip[ping.trip_id].append(ping)

    incidents_by_driver: dict[str, list[Incident]] = defaultdict(list)
    for incident in incidents:
        if incident.driver_id:
            incidents_by_driver[incident.driver_id].append(incident)

    for trip in trips:
        if not trip.assigned_driver_id:
            continue
        duration_hours = max((trip.scheduled_arrival - trip.scheduled_departure).total_seconds() / 3600, 1.0)
        trip_pings = sorted(pings_by_trip.get(trip.id, []), key=lambda p: p.recorded_at)
        if len(trip_pings) >= 2:
            for idx in range(1, len(trip_pings)):
                prev = trip_pings[idx - 1]
                curr = trip_pings[idx]
                delta_h = max((curr.recorded_at - prev.recorded_at).total_seconds() / 3600, 0.01)
                distance_guess = (((curr.lat - prev.lat) ** 2 + (curr.lng - prev.lng) ** 2) ** 0.5) * 111
                speed_guess = distance_guess / delta_h
                if speed_guess > 110:
                    db.add(DriverBehaviorEvent(
                        driver_id=trip.assigned_driver_id,
                        trip_id=trip.id,
                        event_type="speeding",
                        severity="high" if speed_guess > 125 else "medium",
                        measured_value=round(speed_guess, 2),
                        threshold=110.0,
                        notes=f"Estimated speed exceeded threshold on trip {trip.trip_number}.",
                        occurred_at=curr.recorded_at,
                    ))
                    behavior_events_created += 1

        if trip.actual_arrival and trip.scheduled_arrival and trip.actual_arrival > trip.scheduled_arrival + timedelta(minutes=30):
            lateness_minutes = (trip.actual_arrival - trip.scheduled_arrival).total_seconds() / 60
            db.add(DriverBehaviorEvent(
                driver_id=trip.assigned_driver_id,
                trip_id=trip.id,
                event_type="late_arrival",
                severity="medium",
                measured_value=round(lateness_minutes, 2),
                threshold=30.0,
                notes=f"Trip {trip.trip_number} arrived late.",
                occurred_at=trip.actual_arrival,
            ))
            behavior_events_created += 1

        trip_fuels = [log for log in fuel_logs if log.trip_id == trip.id]
        if trip_fuels and trip.distance_km and trip.distance_km > 0:
            litres_per_100 = (sum(log.litres for log in trip_fuels) / trip.distance_km) * 100
            if litres_per_100 > 45:
                db.add(DriverBehaviorEvent(
                    driver_id=trip.assigned_driver_id,
                    trip_id=trip.id,
                    event_type="fuel_inefficiency",
                    severity="medium",
                    measured_value=round(litres_per_100, 2),
                    threshold=45.0,
                    notes=f"Fuel intensity was high on trip {trip.trip_number}.",
                    occurred_at=trip.actual_arrival or trip.scheduled_arrival,
                ))
                behavior_events_created += 1

    behavior_rows = (await db.execute(select(DriverBehaviorEvent).where(DriverBehaviorEvent.occurred_at >= period_start))).scalars().all()
    behavior_by_driver: dict[str, list[DriverBehaviorEvent]] = defaultdict(list)
    for event in behavior_rows:
        behavior_by_driver[event.driver_id].append(event)

    trips_by_driver: dict[str, list[Trip]] = defaultdict(list)
    for trip in trips:
        if trip.assigned_driver_id:
            trips_by_driver[trip.assigned_driver_id].append(trip)

    for driver in drivers:
        driver_trips = trips_by_driver.get(driver.id, [])
        driver_events = behavior_by_driver.get(driver.id, [])
        driver_incidents = incidents_by_driver.get(driver.id, [])

        completed = [t for t in driver_trips if t.status == "completed"]
        on_time = [t for t in completed if t.actual_arrival and t.scheduled_arrival and t.actual_arrival <= t.scheduled_arrival]
        punctuality_score = 100.0 if not completed else round((len(on_time) / len(completed)) * 100, 2)

        safety_penalty = len(driver_events) * 6 + len(driver_incidents) * 10
        safety_score = max(0.0, round(100 - safety_penalty, 2))

        efficiency_penalty = sum(8 for e in driver_events if e.event_type == "fuel_inefficiency")
        efficiency_score = max(0.0, round(100 - efficiency_penalty, 2))

        total_score = round((safety_score * 0.45) + (efficiency_score * 0.25) + (punctuality_score * 0.30), 2)

        scorecard = DriverScorecard(
            driver_id=driver.id,
            score_period_start=period_start,
            score_period_end=now,
            safety_score=safety_score,
            efficiency_score=efficiency_score,
            punctuality_score=punctuality_score,
            total_score=total_score,
            summary=f"{len(driver_events)} driving alerts and {len(driver_incidents)} incidents in the last 30 days.",
            generated_at=now,
        )
        db.add(scorecard)
        scorecards_created += 1

        if total_score < 80:
            recommendation_type = "safety" if safety_score <= efficiency_score else "efficiency"
            db.add(CoachingRecommendation(
                driver_id=driver.id,
                recommendation_type=recommendation_type,
                reason=f"Driver score is {total_score}.",
                suggested_action="Review recent alerts and schedule a coaching check-in.",
                generated_at=now,
            ))

    await db.commit()

    return {
        "generated_at": now,
        "health_scores_created": health_scores_created,
        "predictions_created": predictions_created,
        "anomalies_created": anomalies_created,
        "scorecards_created": scorecards_created,
        "behavior_events_created": behavior_events_created,
    }


async def get_fleet_health(db: AsyncSession) -> tuple[list[VehicleHealthScore], datetime]:
    rows = (await db.execute(select(VehicleHealthScore).order_by(VehicleHealthScore.generated_at.desc()))).scalars().all()
    latest_ts = rows[0].generated_at if rows else _utcnow()
    latest = [r for r in rows if r.generated_at == latest_ts]
    return latest, latest_ts


async def get_predictions_for_truck(db: AsyncSession, truck_id: str) -> list[MaintenancePrediction]:
    return (await db.execute(
        select(MaintenancePrediction)
        .where(MaintenancePrediction.truck_id == truck_id)
        .order_by(MaintenancePrediction.generated_at.desc())
    )).scalars().all()


async def get_anomalies(db: AsyncSession) -> list[AnomalyEvent]:
    return (await db.execute(select(AnomalyEvent).order_by(AnomalyEvent.detected_at.desc()))).scalars().all()


async def get_driver_scorecard(db: AsyncSession, driver_id: str) -> Optional[DriverScorecard]:
    return (await db.execute(
        select(DriverScorecard)
        .where(DriverScorecard.driver_id == driver_id)
        .order_by(DriverScorecard.generated_at.desc())
        .limit(1)
    )).scalar_one_or_none()


async def get_driver_behavior_events(db: AsyncSession, driver_id: str) -> list[DriverBehaviorEvent]:
    return (await db.execute(
        select(DriverBehaviorEvent)
        .where(DriverBehaviorEvent.driver_id == driver_id)
        .order_by(DriverBehaviorEvent.occurred_at.desc())
    )).scalars().all()


async def get_driver_coaching(db: AsyncSession, driver_id: str) -> list[CoachingRecommendation]:
    return (await db.execute(
        select(CoachingRecommendation)
        .where(CoachingRecommendation.driver_id == driver_id)
        .order_by(CoachingRecommendation.generated_at.desc())
    )).scalars().all()


async def get_driver_leaderboard(db: AsyncSession) -> list[tuple[Driver, DriverScorecard]]:
    scorecards = (await db.execute(select(DriverScorecard).order_by(DriverScorecard.generated_at.desc()))).scalars().all()
    latest_map: dict[str, DriverScorecard] = {}
    for row in scorecards:
        latest_map.setdefault(row.driver_id, row)
    drivers = {d.id: d for d in (await db.execute(select(Driver))).scalars().all()}
    ranked = [(drivers[driver_id], card) for driver_id, card in latest_map.items() if driver_id in drivers]
    ranked.sort(key=lambda pair: pair[1].total_score, reverse=True)
    return ranked
