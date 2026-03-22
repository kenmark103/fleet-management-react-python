"""
tests/integration/test_trips.py
Fleet Management System

Covers: /api/v1/trips

RBAC (from schema + test_rbac.py):
  GET  /api/v1/trips          → all authenticated roles
  POST /api/v1/trips          → ADMIN, DISPATCHER
  PATCH /api/v1/trips/{id}    → ADMIN, DISPATCHER
  PATCH /api/v1/trips/{id}/status → ADMIN, DISPATCHER
  DELETE /api/v1/trips/{id}   → ADMIN, DISPATCHER

CamelCase field mapping (TripResponse):
  scheduled_departure   → scheduledDeparture
  scheduled_arrival     → scheduledArrival
  actual_departure      → actualDeparture
  actual_arrival        → actualArrival
  distance_km           → distanceKm
  cargo_description     → cargoDescription
  cargo_weight_tons     → cargoWeightTons
  assigned_truck_id     → assignedTruckId
  assigned_trailer_id   → assignedTrailerId
  assigned_driver_id    → assignedDriverId
  trip_number           → tripNumber
  dispatched_by         → dispatchedBy
  dispatched_by_name    → dispatchedByName

TripStatusEnum: pending | en-route | completed | cancelled
  (hyphens — same pattern as WorkOrderStatusEnum)
"""

import pytest
from httpx import AsyncClient

NULL_UUID = "00000000-0000-0000-0000-000000000000"


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateTrip:

    async def test_create_trip_success(
        self,
        dispatcher_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        payload = {
            "origin": "Nairobi",
            "destination": "Mombasa",
            "scheduled_departure": "2025-11-01T06:00:00Z",
            "scheduled_arrival": "2025-11-01T14:00:00Z",
            "assigned_truck_id": sample_truck_id,
            "assigned_driver_id": sample_driver["id"],
            "cargo_description": "Electronics",
            "cargo_weight_tons": 3.5,
            "distance_km": 480.0,
        }
        res = await dispatcher_client.post("/api/v1/trips", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["origin"] == "Nairobi"
        assert data["destination"] == "Mombasa"
        assert data["status"] == "pending"
        assert data["assignedTruckId"] == sample_truck_id
        assert data["assignedDriverId"] == sample_driver["id"]
        assert "id" in data
        assert "tripNumber" in data   # auto-generated server-side

    async def test_create_trip_without_truck_or_driver(
        self, dispatcher_client: AsyncClient
    ):
        """Truck and driver are optional on TripCreate."""
        payload = {
            "origin": "Nakuru",
            "destination": "Eldoret",
            "scheduled_departure": "2025-11-05T07:00:00Z",
            "scheduled_arrival": "2025-11-05T10:00:00Z",
        }
        res = await dispatcher_client.post("/api/v1/trips", json=payload)
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["assignedTruckId"] is None
        assert data["assignedDriverId"] is None

    async def test_create_trip_with_trailer(
        self,
        dispatcher_client: AsyncClient,
        sample_truck_id: str,
        sample_trailer_id: str,
        sample_driver: dict,
    ):
        payload = {
            "origin": "Nairobi",
            "destination": "Kisumu",
            "scheduled_departure": "2025-11-10T06:00:00Z",
            "scheduled_arrival": "2025-11-10T13:00:00Z",
            "assigned_truck_id": sample_truck_id,
            "assigned_trailer_id": sample_trailer_id,
            "assigned_driver_id": sample_driver["id"],
        }
        res = await dispatcher_client.post("/api/v1/trips", json=payload)
        assert res.status_code == 201
        assert res.json()["data"]["assignedTrailerId"] == sample_trailer_id

    async def test_create_trip_missing_origin(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.post(
            "/api/v1/trips",
            json={
                "destination": "Mombasa",
                "scheduled_departure": "2025-11-01T06:00:00Z",
                "scheduled_arrival": "2025-11-01T14:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_trip_missing_scheduled_dates(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.post(
            "/api/v1/trips",
            json={"origin": "Nairobi", "destination": "Mombasa"},
        )
        assert res.status_code == 422

    async def test_create_trip_requires_dispatcher_role(
        self,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        """MECHANIC must receive 403."""
        res = await auth_client.post(
            "/api/v1/trips",
            json={
                "origin": "Nairobi",
                "destination": "Mombasa",
                "scheduled_departure": "2025-11-01T06:00:00Z",
                "scheduled_arrival": "2025-11-01T14:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_create_trip_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/trips",
            json={
                "origin": "Nairobi",
                "destination": "Mombasa",
                "scheduled_departure": "2025-11-01T06:00:00Z",
                "scheduled_arrival": "2025-11-01T14:00:00Z",
            },
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetTrips:

    async def test_list_trips(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        res = await dispatcher_client.get("/api/v1/trips")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_trips_filter_by_status(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        res = await dispatcher_client.get(
            "/api/v1/trips", params={"status": "pending"}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["status"] == "pending"

    async def test_list_trips_filter_by_truck(
        self,
        dispatcher_client: AsyncClient,
        sample_trip: dict,
        sample_truck_id: str,
    ):
        res = await dispatcher_client.get(
            "/api/v1/trips", params={"truck_id": sample_truck_id}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["assignedTruckId"] == sample_truck_id

    async def test_list_trips_filter_by_driver(
        self,
        dispatcher_client: AsyncClient,
        sample_trip: dict,
        sample_driver: dict,
    ):
        res = await dispatcher_client.get(
            "/api/v1/trips", params={"driver_id": sample_driver["id"]}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["assignedDriverId"] == sample_driver["id"]

    async def test_list_trips_pagination(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        res = await dispatcher_client.get(
            "/api/v1/trips", params={"page": 1, "page_size": 1}
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 1
        assert body["meta"]["pageSize"] == 1

    async def test_get_single_trip(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        trip_id = sample_trip["id"]
        res = await dispatcher_client.get(f"/api/v1/trips/{trip_id}")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == trip_id
        assert "tripNumber" in data
        assert "scheduledDeparture" in data
        assert "scheduledArrival" in data

    async def test_get_nonexistent_trip(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.get(f"/api/v1/trips/{NULL_UUID}")
        assert res.status_code == 404

    async def test_mechanic_can_list_trips(
        self, auth_client: AsyncClient, sample_trip: dict
    ):
        res = await auth_client.get("/api/v1/trips")
        assert res.status_code == 200

    async def test_driver_can_list_trips(
        self, driver_client: AsyncClient, sample_trip: dict
    ):
        res = await driver_client.get("/api/v1/trips")
        assert res.status_code == 200

    async def test_finance_can_list_trips(
        self, finance_client: AsyncClient, sample_trip: dict
    ):
        res = await finance_client.get("/api/v1/trips")
        assert res.status_code == 200

    async def test_list_trips_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/trips")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateTrip:

    async def test_update_trip_cargo_info(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        trip_id = sample_trip["id"]
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{trip_id}",
            json={
                "cargo_description": "Pharmaceutical supplies",
                "cargo_weight_tons": 2.0,
            },
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["cargoDescription"] == "Pharmaceutical supplies"
        assert data["cargoWeightTons"] == 2.0

    async def test_update_trip_assign_trailer(
        self,
        dispatcher_client: AsyncClient,
        sample_trip: dict,
        sample_trailer_id: str,
    ):
        trip_id = sample_trip["id"]
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{trip_id}",
            json={"assigned_trailer_id": sample_trailer_id},
        )
        assert res.status_code == 200
        assert res.json()["data"]["assignedTrailerId"] == sample_trailer_id

    async def test_partial_update_preserves_other_fields(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        trip_id = sample_trip["id"]
        original_origin = sample_trip["origin"]

        await dispatcher_client.patch(
            f"/api/v1/trips/{trip_id}", json={"notes": "Check tire pressure"}
        )
        refetched = (
            await dispatcher_client.get(f"/api/v1/trips/{trip_id}")
        ).json()["data"]
        assert refetched["origin"] == original_origin
        assert refetched["notes"] == "Check tire pressure"

    async def test_update_nonexistent_trip(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{NULL_UUID}",
            json={"notes": "Ghost update"},
        )
        assert res.status_code == 404

    async def test_update_trip_requires_dispatcher(
        self, auth_client: AsyncClient, sample_trip: dict
    ):
        res = await auth_client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json={"notes": "Mechanic trying to update"},
        )
        assert res.status_code == 403

    async def test_update_trip_requires_auth(
        self, client: AsyncClient, sample_trip: dict
    ):
        res = await client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json={"notes": "Anon update"},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# STATUS TRANSITIONS
# ─────────────────────────────────────────────────────────────────────────────

class TestTripStatus:
    """
    TripStatusEnum: pending → en-route → completed
                    pending → cancelled
    Note: hyphens in 'en-route' (not underscore).
    """

    async def test_pending_to_en_route(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={"status": "en-route"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "en-route"

    async def test_en_route_to_completed(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        trip_id = sample_trip["id"]
        await dispatcher_client.patch(
            f"/api/v1/trips/{trip_id}/status", json={"status": "en-route"}
        )
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{trip_id}/status", json={"status": "completed"}
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "completed"

    async def test_pending_to_cancelled(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={"status": "cancelled"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "cancelled"

    async def test_completed_trip_cannot_change_status(
        self, dispatcher_client: AsyncClient, completed_trip: dict
    ):
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{completed_trip['id']}/status",
            json={"status": "pending"},
        )
        assert res.status_code in (409, 422)

    async def test_invalid_status_value(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={"status": "teleporting"},
        )
        assert res.status_code == 422

    async def test_status_update_with_notes(
        self, dispatcher_client: AsyncClient, sample_trip: dict
    ):
        """TripStatusUpdateRequest accepts optional notes and location."""
        res = await dispatcher_client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={
                "status": "en-route",
                "notes": "Departed on schedule",
                "location_lat": -1.2921,
                "location_lng": 36.8219,
            },
        )
        assert res.status_code == 200

    async def test_status_update_requires_dispatcher(
        self, auth_client: AsyncClient, sample_trip: dict
    ):
        res = await auth_client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={"status": "en-route"},
        )
        assert res.status_code == 403

    async def test_status_update_requires_auth(
        self, client: AsyncClient, sample_trip: dict
    ):
        res = await client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={"status": "en-route"},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteTrip:

    async def test_delete_pending_trip(
        self,
        dispatcher_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        """Create a fresh pending trip and delete it."""
        created = await dispatcher_client.post(
            "/api/v1/trips",
            json={
                "origin": "Nairobi",
                "destination": "Thika",
                "scheduled_departure": "2025-12-01T06:00:00Z",
                "scheduled_arrival": "2025-12-01T07:30:00Z",
                "assigned_truck_id": sample_truck_id,
            },
        )
        assert created.status_code == 201
        trip_id = created.json()["data"]["id"]

        res = await dispatcher_client.delete(f"/api/v1/trips/{trip_id}")
        assert res.status_code in (200, 204)

        get_res = await dispatcher_client.get(f"/api/v1/trips/{trip_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_trip(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.delete(f"/api/v1/trips/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_trip_requires_dispatcher(
        self, auth_client: AsyncClient, sample_trip: dict
    ):
        res = await auth_client.delete(f"/api/v1/trips/{sample_trip['id']}")
        assert res.status_code == 403

    async def test_delete_trip_requires_auth(
        self, client: AsyncClient, sample_trip: dict
    ):
        res = await client.delete(f"/api/v1/trips/{sample_trip['id']}")
        assert res.status_code == 401