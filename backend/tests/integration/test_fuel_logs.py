"""
tests/integration/test_fuel_logs.py
Fleet Management System

Covers: /api/v1/fuel  (FuelLog CRUD)

RBAC (from schema comments):
  POST /api/v1/fuel          → ADMIN, DRIVER
  GET  /api/v1/fuel          → all authenticated roles
  PATCH /api/v1/fuel/{id}    → ADMIN, FINANCE
  DELETE /api/v1/fuel/{id}   → ADMIN, FINANCE

IMPORTANT — FuelLogCreate schema:
  total_cost is computed server-side (litres × price_per_litre).
  Do NOT send total_cost in request payloads — the schema omits it.

CamelCase field mapping (FuelLogResponse):
  truck_id          → truckId
  driver_id         → driverId
  trip_id           → tripId
  price_per_litre   → pricePerLitre
  total_cost        → totalCost        (in response only)
  odometer_at_fuel  → odometerAtFuel
  station_name      → stationName
  station_location  → stationLocation
  receipt_url       → receiptUrl
  logged_at         → loggedAt
  truck_plate       → truckPlate
  driver_name       → driverName
  trip_number       → tripNumber
  created_at        → createdAt
  updated_at        → updatedAt
"""

import pytest
from httpx import AsyncClient

NULL_UUID = "00000000-0000-0000-0000-000000000000"


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateFuelLog:

    async def test_create_fuel_log_success(
        self,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        """
        POST /api/v1/fuel — ADMIN or DRIVER role.
        total_cost is NOT sent — server computes it from litres × price_per_litre.
        """
        payload = {
            "truck_id": sample_truck_id,
            "driver_id": sample_driver["id"],
            "litres": 80.0,
            "price_per_litre": 1.45,
            "odometer_at_fuel": 52000.0,
            "logged_at": "2025-07-15T11:00:00Z",
            "station_name": "Total Nairobi West",
        }
        res = await auth_client.post("/api/v1/fuel", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["truckId"] == sample_truck_id
        assert data["driverId"] == sample_driver["id"]
        assert data["litres"] == 80.0
        assert data["pricePerLitre"] == 1.45
        # total_cost must be in response (server-computed)
        assert "totalCost" in data
        assert data["totalCost"] == pytest.approx(80.0 * 1.45, rel=1e-3)
        assert data["stationName"] == "Total Nairobi West"

    async def test_create_fuel_log_minimal_fields(
        self,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        """Only required fields — all optional fields absent."""
        payload = {
            "truck_id": sample_truck_id,
            "driver_id": sample_driver["id"],
            "litres": 50.0,
            "price_per_litre": 1.50,
            "odometer_at_fuel": 60000.0,
            "logged_at": "2025-07-20T08:00:00Z",
        }
        res = await auth_client.post("/api/v1/fuel", json=payload)
        assert res.status_code == 201
        assert res.json()["data"]["totalCost"] == pytest.approx(75.0, rel=1e-3)

    async def test_create_fuel_log_with_trip_link(
        self,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
        sample_trip: dict,
    ):
        """Optionally link a fuel log to a trip."""
        payload = {
            "truck_id": sample_truck_id,
            "driver_id": sample_driver["id"],
            "trip_id": sample_trip["id"],
            "litres": 60.0,
            "price_per_litre": 1.48,
            "odometer_at_fuel": 53000.0,
            "logged_at": "2025-07-16T14:00:00Z",
        }
        res = await auth_client.post("/api/v1/fuel", json=payload)
        assert res.status_code == 201
        assert res.json()["data"]["tripId"] == sample_trip["id"]

    async def test_create_fuel_log_zero_litres_rejected(
        self,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        """litres field has gt=0 constraint — zero must be rejected."""
        res = await auth_client.post(
            "/api/v1/fuel",
            json={
                "truck_id": sample_truck_id,
                "driver_id": sample_driver["id"],
                "litres": 0.0,
                "price_per_litre": 1.45,
                "odometer_at_fuel": 52000.0,
                "logged_at": "2025-07-15T11:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_fuel_log_negative_litres_rejected(
        self,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        res = await auth_client.post(
            "/api/v1/fuel",
            json={
                "truck_id": sample_truck_id,
                "driver_id": sample_driver["id"],
                "litres": -10.0,
                "price_per_litre": 1.45,
                "odometer_at_fuel": 52000.0,
                "logged_at": "2025-07-15T11:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_fuel_log_nonexistent_truck(
        self,
        auth_client: AsyncClient,
        sample_driver: dict,
    ):
        res = await auth_client.post(
            "/api/v1/fuel",
            json={
                "truck_id": NULL_UUID,
                "driver_id": sample_driver["id"],
                "litres": 50.0,
                "price_per_litre": 1.45,
                "odometer_at_fuel": 50000.0,
                "logged_at": "2025-07-15T11:00:00Z",
            },
        )
        assert res.status_code in (404, 422)

    async def test_create_fuel_log_missing_required_fields(
        self, auth_client: AsyncClient
    ):
        """Omit truck_id — required field."""
        res = await auth_client.post(
            "/api/v1/fuel",
            json={"litres": 50.0, "price_per_litre": 1.45},
        )
        assert res.status_code == 422

    async def test_create_fuel_log_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/fuel", json={})
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetFuelLogs:

    async def test_list_fuel_logs(
        self, auth_client: AsyncClient, sample_fuel_log: dict
    ):
        res = await auth_client.get("/api/v1/fuel")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_fuel_logs_filter_by_truck(
        self,
        auth_client: AsyncClient,
        sample_fuel_log: dict,
        sample_truck_id: str,
    ):
        res = await auth_client.get(
            "/api/v1/fuel", params={"truck_id": sample_truck_id}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["truckId"] == sample_truck_id

    async def test_list_fuel_logs_filter_by_driver(
        self,
        auth_client: AsyncClient,
        sample_fuel_log: dict,
        sample_driver: dict,
    ):
        res = await auth_client.get(
            "/api/v1/fuel", params={"driver_id": sample_driver["id"]}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["driverId"] == sample_driver["id"]

    async def test_list_fuel_logs_pagination(
        self, auth_client: AsyncClient, sample_fuel_log: dict
    ):
        res = await auth_client.get(
            "/api/v1/fuel", params={"page": 1, "page_size": 1}
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 1
        assert body["meta"]["pageSize"] == 1

    async def test_get_single_fuel_log(
        self, auth_client: AsyncClient, sample_fuel_log: dict
    ):
        log_id = sample_fuel_log["id"]
        res = await auth_client.get(f"/api/v1/fuel/{log_id}")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == log_id
        assert "totalCost" in data
        assert "litres" in data

    async def test_get_nonexistent_fuel_log(self, auth_client: AsyncClient):
        res = await auth_client.get(f"/api/v1/fuel/{NULL_UUID}")
        assert res.status_code == 404

    async def test_list_fuel_logs_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/fuel")
        assert res.status_code == 401

    async def test_dispatcher_can_read_fuel_logs(
        self, dispatcher_client: AsyncClient, sample_fuel_log: dict
    ):
        res = await dispatcher_client.get("/api/v1/fuel")
        assert res.status_code == 200

    async def test_finance_can_read_fuel_logs(
        self, finance_client: AsyncClient, sample_fuel_log: dict
    ):
        res = await finance_client.get("/api/v1/fuel")
        assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateFuelLog:
    """
    PATCH /api/v1/fuel/{id} — ADMIN, FINANCE only.
    FuelLogUpdate: all fields optional.
    """

    async def test_update_station_info(
        self, finance_client: AsyncClient, sample_fuel_log: dict
    ):
        log_id = sample_fuel_log["id"]
        res = await finance_client.patch(
            f"/api/v1/fuel/{log_id}",
            json={
                "station_name": "Shell Westlands",
                "station_location": "Westlands, Nairobi",
            },
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["stationName"] == "Shell Westlands"
        assert data["stationLocation"] == "Westlands, Nairobi"

    async def test_update_litres_recalculates_total(
        self, finance_client: AsyncClient, sample_fuel_log: dict
    ):
        """Updating litres should recalculate total_cost server-side."""
        log_id = sample_fuel_log["id"]
        original_price = sample_fuel_log["pricePerLitre"]
        res = await finance_client.patch(
            f"/api/v1/fuel/{log_id}", json={"litres": 100.0}
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["litres"] == 100.0
        assert data["totalCost"] == pytest.approx(100.0 * original_price, rel=1e-3)

    async def test_update_partial_preserves_other_fields(
        self, finance_client: AsyncClient, sample_fuel_log: dict
    ):
        log_id = sample_fuel_log["id"]
        original_truck_id = sample_fuel_log["truckId"]

        await finance_client.patch(
            f"/api/v1/fuel/{log_id}", json={"station_name": "BP Karen"}
        )
        refetched = (
            await finance_client.get(f"/api/v1/fuel/{log_id}")
        ).json()["data"]
        assert refetched["truckId"] == original_truck_id
        assert refetched["stationName"] == "BP Karen"

    async def test_update_nonexistent_fuel_log(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.patch(
            f"/api/v1/fuel/{NULL_UUID}",
            json={"station_name": "Ghost Station"},
        )
        assert res.status_code == 404

    async def test_update_fuel_log_requires_finance_or_admin(
        self, auth_client: AsyncClient, sample_fuel_log: dict
    ):
        """MECHANIC must not be able to update fuel logs."""
        res = await auth_client.patch(
            f"/api/v1/fuel/{sample_fuel_log['id']}",
            json={"station_name": "Mechanic Station"},
        )
        assert res.status_code == 403

    async def test_update_fuel_log_requires_auth(
        self, client: AsyncClient, sample_fuel_log: dict
    ):
        res = await client.patch(
            f"/api/v1/fuel/{sample_fuel_log['id']}",
            json={"station_name": "Anon"},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteFuelLog:

    async def test_delete_fuel_log(
        self,
        finance_client: AsyncClient,
        auth_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        """Create a log then delete it — subsequent GET must 404."""
        created = await auth_client.post(
            "/api/v1/fuel",
            json={
                "truck_id": sample_truck_id,
                "driver_id": sample_driver["id"],
                "litres": 40.0,
                "price_per_litre": 1.50,
                "odometer_at_fuel": 65000.0,
                "logged_at": "2025-08-01T09:00:00Z",
            },
        )
        assert created.status_code == 201
        log_id = created.json()["data"]["id"]

        res = await finance_client.delete(f"/api/v1/fuel/{log_id}")
        assert res.status_code in (200, 204)

        get_res = await auth_client.get(f"/api/v1/fuel/{log_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_fuel_log(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.delete(f"/api/v1/fuel/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_fuel_log_requires_finance_or_admin(
        self, auth_client: AsyncClient, sample_fuel_log: dict
    ):
        res = await auth_client.delete(f"/api/v1/fuel/{sample_fuel_log['id']}")
        assert res.status_code == 403

    async def test_delete_fuel_log_requires_auth(
        self, client: AsyncClient, sample_fuel_log: dict
    ):
        res = await client.delete(f"/api/v1/fuel/{sample_fuel_log['id']}")
        assert res.status_code == 401