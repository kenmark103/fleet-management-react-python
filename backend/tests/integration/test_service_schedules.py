"""
tests/integration/test_service_schedules.py
Fleet Management System — UPDATED for current schema

Changes:
- vehicle_id → truck_id
- interval_miles/interval_days → interval_type + interval_value
- last_service_mileage → last_service_odometer
- Removed next_service_date/next_service_mileage from POST (computed server-side)
"""

import pytest
from httpx import AsyncClient


class TestCreateServiceSchedule:
    async def test_create_schedule_km_interval(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        """FIXED: Uses new interval schema"""
        payload = {
            "truck_id": sample_truck_id,  # CHANGED: was vehicle_id
            "service_type": "oil_change",
            "interval_type": "km",  # ADDED
            "interval_value": 5000,  # ADDED
            "last_service_date": "2025-01-15T00:00:00Z",
            "last_service_odometer": 45000.0,  # CHANGED: was last_service_mileage
        }
        res = await auth_client.post("/api/v1/maintenance/schedules", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["serviceType"] == "oil_change"
        assert data["truckId"] == sample_truck_id
        assert data["intervalType"] == "km"
        assert data["intervalValue"] == 5000
        assert "nextServiceDate" in data  # computed by server
        assert "nextServiceOdometer" in data  # computed by server

    async def test_create_schedule_days_interval(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        """Test days-based interval"""
        payload = {
            "truck_id": sample_truck_id,
            "service_type": "tire_rotation",
            "interval_type": "days",  # ADDED
            "interval_value": 30,  # ADDED: 30 days
            "last_service_date": "2025-01-01T00:00:00Z",
        }
        res = await auth_client.post("/api/v1/maintenance/schedules", json=payload)
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["intervalType"] == "days"
        assert data["intervalValue"] == 30

    async def test_create_schedule_missing_truck(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/v1/maintenance/schedules",
            json={
                "service_type": "oil_change",
                "interval_type": "km",  # ADDED
                "interval_value": 5000,  # ADDED
            },
        )
        assert res.status_code == 422

    async def test_create_schedule_invalid_interval_value(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.post(
            "/api/v1/maintenance/schedules",
            json={
                "truck_id": sample_truck_id,
                "service_type": "tire_rotation",
                "interval_type": "km",
                "interval_value": -100,  # invalid
            },
        )
        assert res.status_code == 422

    async def test_create_schedule_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/maintenance/schedules",
            json={"truck_id": "x", "service_type": "oil_change"},
        )
        assert res.status_code == 401


class TestGetServiceSchedules:
    async def test_list_schedules(
        self, auth_client: AsyncClient, service_schedule
    ):
        res = await auth_client.get("/api/v1/maintenance/schedules")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_schedules_filter_by_truck(
        self, auth_client: AsyncClient, service_schedule, sample_truck_id: str
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/schedules",
            params={"truck_id": sample_truck_id},  # CHANGED: was vehicle_id
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["truckId"] == sample_truck_id

    async def test_list_schedules_filter_due_soon(
        self, auth_client: AsyncClient, overdue_schedule
    ):
        """Schedules due within the next 30 days should be filterable."""
        res = await auth_client.get(
            "/api/v1/maintenance/schedules", params={"due_soon": True}  # CHANGED: param name
        )
        assert res.status_code == 200
        assert len(res.json()["data"]) >= 1

    async def test_get_single_schedule(
        self, auth_client: AsyncClient, service_schedule: dict
    ):
        sched_id = service_schedule["id"]
        res = await auth_client.get(f"/api/v1/maintenance/schedules/{sched_id}")

        assert res.status_code == 200
        assert res.json()["data"]["id"] == sched_id

    async def test_get_nonexistent_schedule(self, auth_client: AsyncClient):
        res = await auth_client.get(
            "/api/v1/maintenance/schedules/00000000-0000-0000-0000-000000000000"
        )
        assert res.status_code == 404


class TestUpdateServiceSchedule:
    async def test_update_schedule_interval(
        self, auth_client: AsyncClient, service_schedule: dict
    ):
        sched_id = service_schedule["id"]
        res = await auth_client.patch(
            f"/api/v1/maintenance/schedules/{sched_id}",
            json={
                "interval_type": "km",  # ADDED
                "interval_value": 7500,  # CHANGED: was interval_miles
            },
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["intervalType"] == "km"
        assert data["intervalValue"] == 7500

    async def test_update_schedule_last_service(
        self, auth_client: AsyncClient, service_schedule: dict
    ):
        """Updating last service should recompute next service."""
        sched_id = service_schedule["id"]
        res = await auth_client.patch(
            f"/api/v1/maintenance/schedules/{sched_id}",
            json={
                "last_service_date": "2025-04-01T00:00:00Z",
                "last_service_odometer": 52000.0,  # CHANGED
            },
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["lastServiceDate"] == "2025-04-01T00:00:00Z"
        assert data["nextServiceOdometer"] > 52000

    async def test_update_nonexistent_schedule(self, auth_client: AsyncClient):
        res = await auth_client.patch(
            "/api/v1/maintenance/schedules/00000000-0000-0000-0000-000000000000",
            json={"interval_value": 5000},  # CHANGED
        )
        assert res.status_code == 404


class TestDeleteServiceSchedule:
    async def test_delete_schedule(
        self, auth_client: AsyncClient, service_schedule: dict
    ):
        sched_id = service_schedule["id"]
        res = await auth_client.delete(f"/api/v1/maintenance/schedules/{sched_id}")
        assert res.status_code in (200, 204)

        get_res = await auth_client.get(f"/api/v1/maintenance/schedules/{sched_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_schedule(self, auth_client: AsyncClient):
        res = await auth_client.delete(
            "/api/v1/maintenance/schedules/00000000-0000-0000-0000-000000000000"
        )
        assert res.status_code == 404

    async def test_delete_requires_auth(
        self, client: AsyncClient, service_schedule: dict
    ):
        res = await client.delete(
            f"/api/v1/maintenance/schedules/{service_schedule['id']}"
        )
        assert res.status_code == 401