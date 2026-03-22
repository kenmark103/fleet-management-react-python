"""
tests/integration/test_work_orders.py
Fleet Management System — UPDATED for current schema

Changes from original:
- vehicle_id → truck_id
- status "open" → "pending", "in_progress" → "in-progress"
- Added assigned_mechanic_id (required field)
- Added description (required field)
- ISO datetime format with timezone
"""

import pytest
from httpx import AsyncClient


class TestCreateWorkOrder:
    async def test_create_work_order_success(
        self, auth_client: AsyncClient, sample_truck_id: str, mechanic_user_id: str
    ):
        """FIXED: Added mechanic_user_id, changed vehicle_id to truck_id"""
        payload = {
            "truck_id": sample_truck_id,
            "assigned_mechanic_id": mechanic_user_id,
            "title": "Engine oil change",
            "description": "Full synthetic 5W-30",
            "priority": "medium",
            "scheduled_date": "2025-06-01T09:00:00Z",
        }
        res = await auth_client.post("/api/v1/maintenance/work-orders", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["title"] == payload["title"]
        assert data["status"] == "pending"  # CHANGED: was "open"
        assert data["truckId"] == sample_truck_id
        assert "id" in data

    async def test_create_work_order_missing_required_fields(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.post(
            "/api/v1/maintenance/work-orders", json={"title": "No truck"}
        )
        assert res.status_code == 422

    async def test_create_work_order_invalid_priority(
        self, auth_client: AsyncClient, sample_truck_id: str, mechanic_user_id: str
    ):
        payload = {
            "truck_id": sample_truck_id,
            "assigned_mechanic_id": mechanic_user_id,
            "title": "Bad priority",
            "description": "Test",
            "priority": "super_urgent",
        }
        res = await auth_client.post("/api/v1/maintenance/work-orders", json=payload)
        assert res.status_code == 422

    async def test_create_work_order_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/maintenance/work-orders",
            json={"truck_id": "x", "title": "Unauth", "description": "Test"},
        )
        assert res.status_code == 401


class TestGetWorkOrders:
    async def test_list_work_orders(self, auth_client: AsyncClient, work_order):
        res = await auth_client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_work_orders_pagination(
        self, auth_client: AsyncClient, multiple_work_orders
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders", params={"page": 1, "page_size": 2}
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 2

    async def test_list_work_orders_filter_by_status(
        self, auth_client: AsyncClient, work_order
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders", params={"status": "pending"}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["status"] == "pending"

    async def test_list_work_orders_filter_by_truck(
        self, auth_client: AsyncClient, work_order, sample_truck_id: str
    ):
        res = await auth_client.get(
            "/api/v1/maintenance/work-orders",
            params={"truck_id": sample_truck_id},
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["truckId"] == sample_truck_id

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


class TestWorkOrderStatus:
    async def test_update_status_pending_to_in_progress(
        self, auth_client: AsyncClient, work_order: dict
    ):
        """FIXED: Status uses hyphen 'in-progress' not underscore"""
        wo_id = work_order["id"]
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}/status",
            json={"status": "in-progress"},  # CHANGED: was "in_progress"
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "in-progress"

    async def test_update_status_to_completed(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{wo_id}/status",
            json={"status": "in-progress"},
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
        res = await auth_client.patch(
            f"/api/v1/maintenance/work-orders/{completed_work_order['id']}/status",
            json={"status": "pending"},
        )
        assert res.status_code in (409, 422)


class TestDeleteWorkOrder:
    async def test_delete_work_order(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        res = await auth_client.delete(f"/api/v1/maintenance/work-orders/{wo_id}")
        assert res.status_code in (200, 204)

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