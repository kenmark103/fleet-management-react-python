"""
tests/integration/test_work_orders.py
Fleet Management System — Phase 7

Integration tests for the Work Order API.
These tests run against a real PostgreSQL test DB (spun up by CI).
"""

import pytest
from httpx import AsyncClient


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateWorkOrder:
    async def test_create_work_order_success(
        self, auth_client: AsyncClient, sample_vehicle_id: str
    ):
        payload = {
            "vehicle_id": sample_vehicle_id,
            "title": "Engine oil change",
            "description": "Full synthetic 5W-30",
            "priority": "medium",
            "scheduled_date": "2025-06-01",
        }
        res = await auth_client.post("/api/v1/maintenance/work-orders", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["title"] == payload["title"]
        assert data["status"] == "open"
        assert data["vehicle_id"] == sample_vehicle_id
        assert "id" in data

    async def test_create_work_order_missing_required_fields(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.post(
            "/api/v1/maintenance/work-orders", json={"title": "No vehicle"}
        )
        assert res.status_code == 422

    async def test_create_work_order_invalid_priority(
        self, auth_client: AsyncClient, sample_vehicle_id: str
    ):
        payload = {
            "vehicle_id": sample_vehicle_id,
            "title": "Bad priority",
            "priority": "super_urgent",  # not a valid enum value
        }
        res = await auth_client.post("/api/v1/maintenance/work-orders", json=payload)
        assert res.status_code == 422

    async def test_create_work_order_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/maintenance/work-orders",
            json={"vehicle_id": "x", "title": "Unauth"},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetWorkOrders:
    async def test_list_work_orders(self, auth_client: AsyncClient, work_order):
        res = await auth_client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 200
        body = res.json()
        assert "items" in body
        assert "total" in body
        assert isinstance(body["items"], list)

    async def test_list_work_orders_pagination(
        self, auth_client: AsyncClient, multiple_work_orders
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders", params={"page": 1, "page_size": 2}
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["items"]) <= 2

    async def test_list_work_orders_filter_by_status(
        self, auth_client: AsyncClient, work_order
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders", params={"status": "open"}
        )
        assert res.status_code == 200
        for item in res.json()["items"]:
            assert item["status"] == "open"

    async def test_list_work_orders_filter_by_vehicle(
        self, auth_client: AsyncClient, work_order, sample_vehicle_id: str
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders",
            params={"vehicle_id": sample_vehicle_id},
        )
        assert res.status_code == 200
        for item in res.json()["items"]:
            assert item["vehicle_id"] == sample_vehicle_id

    async def test_get_single_work_order(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        res = await auth_client.get(f"/api/v1/maintenance/work-orders/{wo_id}")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == wo_id

    async def test_get_nonexistent_work_order(self, auth_client: AsyncClient):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000"
        )
        assert res.status_code == 404

    async def test_list_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/maintenance/work-orders")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateWorkOrder:
    async def test_update_work_order_fields(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}",
            json={"title": "Updated title", "priority": "high"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == "Updated title"
        assert data["priority"] == "high"

    async def test_partial_update_preserves_other_fields(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        original_title = work_order["title"]

        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}",
            json={"priority": "low"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["title"] == original_title

    async def test_update_nonexistent_work_order(self, auth_client: AsyncClient):
        res = await auth_client.patch(
            "/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000",
            json={"title": "Ghost"},
        )
        assert res.status_code == 404

    async def test_update_requires_auth(
        self, client: AsyncClient, work_order: dict
    ):
        res = await client.patch(
            f"/api/v1/maintenance/work-orders/{work_order['id']}",
            json={"title": "Unauth"},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# STATUS TRANSITIONS
# ─────────────────────────────────────────────────────────────────────────────

class TestWorkOrderStatus:
    async def test_update_status_open_to_in_progress(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}/status",
            json={"status": "in_progress"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "in_progress"

    async def test_update_status_to_completed(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        # Move through valid states
        await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}/status",
            json={"status": "in_progress"},
        )
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}/status",
            json={"status": "completed"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "completed"

    async def test_invalid_status_value(
        self, auth_client: AsyncClient, work_order: dict
    ):
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{work_order['id']}/status",
            json={"status": "flying"},
        )
        assert res.status_code == 422

    async def test_completed_order_cannot_reopen(
        self, auth_client: AsyncClient, completed_work_order: dict
    ):
        """Completed work orders should not transition back to open."""
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{completed_work_order['id']}/status",
            json={"status": "open"},
        )
        # Expect 409 Conflict or 422 depending on your business rule implementation
        assert res.status_code in (409, 422)


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteWorkOrder:
    async def test_delete_work_order(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        res = await auth_client.delete(f"/api/v1/maintenance/work-orders/{wo_id}")
        assert res.status_code in (200, 204)

        # Confirm it's gone
        get_res = await auth_client.get(f"/api/v1/maintenance/work-orders/{wo_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_work_order(self, auth_client: AsyncClient):
        res = await auth_client.delete(
            "/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000"
        )
        assert res.status_code == 404

    async def test_delete_requires_auth(
        self, client: AsyncClient, work_order: dict
    ):
        res = await client.delete(
            f"/api/v1/maintenance/work-orders/{work_order['id']}"
        )
        assert res.status_code == 401