"""
tests/integration/test_service_schedules.py
Fleet Management System — Phase 7

Integration tests for the Service Schedule API.
"""

import pytest
from httpx import AsyncClient


class TestCreateServiceSchedule:
    async def test_create_schedule_success(
        self, auth_client: AsyncClient, sample_vehicle_id: str
    ):
        payload = {
            "vehicle_id": sample_vehicle_id,
            "service_type": "oil_change",
            "interval_miles": 5000,
            "interval_days": 90,
            "last_service_date": "2025-01-15",
            "last_service_mileage": 45000,
        }
        res = await auth_client.post("/api/v1/maintenance/schedules", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["service_type"] == "oil_change"
        assert data["vehicle_id"] == sample_vehicle_id
        assert "next_service_date" in data  # computed field
        assert "next_service_mileage" in data

    async def test_create_schedule_missing_vehicle(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/v1/maintenance/schedules",
            json={"service_type": "oil_change", "interval_miles": 5000},
        )
        assert res.status_code == 422

    async def test_create_schedule_invalid_interval(
        self, auth_client: AsyncClient, sample_vehicle_id: str
    ):
        res = await auth_client.post(
            "/api/v1/maintenance/schedules",
            json={
                "vehicle_id": sample_vehicle_id,
                "service_type": "tire_rotation",
                "interval_miles": -100,
            },
        )
        assert res.status_code == 422

    async def test_create_schedule_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/maintenance/schedules",
            json={"vehicle_id": "x", "service_type": "oil_change"},
        )
        assert res.status_code == 401


class TestGetServiceSchedules:
    async def test_list_schedules(
        self, auth_client: AsyncClient, service_schedule
    ):
        res = await auth_client.get("/api/v1/maintenance/schedules")

        assert res.status_code == 200
        body = res.json()
        assert "items" in body
        assert isinstance(body["items"], list)

    async def test_list_schedules_filter_by_vehicle(
        self, auth_client: AsyncClient, service_schedule, sample_vehicle_id: str
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/schedules",
            params={"vehicle_id": sample_vehicle_id},
        )
        assert res.status_code == 200
        for item in res.json()["items"]:
            assert item["vehicle_id"] == sample_vehicle_id

    async def test_list_schedules_filter_due_soon(
        self, auth_client: AsyncClient, overdue_schedule
    ):
        """Schedules due within the next 30 days should be filterable."""
        res = await auth_client.get(
            "/api/v1/maintenance/schedules", params={"due_within_days": 30}
        )
        assert res.status_code == 200
        assert len(res.json()["items"]) >= 1

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
            json={"interval_miles": 7500},
        )
        assert res.status_code == 200
        assert res.json()["data"]["interval_miles"] == 7500

    async def test_update_schedule_last_service(
        self, auth_client: AsyncClient, service_schedule: dict
    ):
        """Updating last service should recompute next service."""
        sched_id = service_schedule["id"]
        res = await auth_client.patch(
            f"/api/v1/maintenance/schedules/{sched_id}",
            json={"last_service_date": "2025-04-01", "last_service_mileage": 52000},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["last_service_date"] == "2025-04-01"
        # next_service_* should be recomputed
        assert data["next_service_mileage"] > 52000

    async def test_update_nonexistent_schedule(self, auth_client: AsyncClient):
        res = await auth_client.patch(
            "/api/v1/maintenance/schedules/00000000-0000-0000-0000-000000000000",
            json={"interval_miles": 5000},
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