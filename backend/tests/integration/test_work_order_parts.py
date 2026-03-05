"""
tests/integration/test_work_order_parts.py
Fleet Management System — Phase 7

Integration tests for adding and removing parts on work orders.
"""

import pytest
from httpx import AsyncClient


class TestWorkOrderParts:
    async def test_add_part_to_work_order(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        payload = {
            "part_number": "OIL-5W30-1QT",
            "name": "Synthetic Motor Oil 1Qt",
            "quantity": 5,
            "unit_cost": 8.99,
        }
        res = await auth_client.post(
            f"/api/v1/maintenance/work-orders/{wo_id}/parts", json=payload
        )
        assert res.status_code == 201
        data = res.json()["data"] if "data" in res.json() else res.json()
        assert data["part_number"] == payload["part_number"]
        assert data["quantity"] == 5

    async def test_add_multiple_parts(
        self, auth_client: AsyncClient, work_order: dict
    ):
        wo_id = work_order["id"]
        parts = [
            {"part_number": "FLT-001", "name": "Oil Filter", "quantity": 1, "unit_cost": 12.50},
            {"part_number": "GKT-002", "name": "Drain Plug Gasket", "quantity": 1, "unit_cost": 2.00},
        ]
        for part in parts:
            res = await auth_client.post(
                f"/api/v1/maintenance/work-orders/{wo_id}/parts", json=part
            )
            assert res.status_code == 201

        # Confirm both appear on the work order
        wo_res = await auth_client.get(f"/api/v1/maintenance/work-orders/{wo_id}")
        assert wo_res.status_code == 200
        part_numbers = [p["part_number"] for p in wo_res.json()["data"]["parts"]]
        assert "FLT-001" in part_numbers
        assert "GKT-002" in part_numbers

    async def test_add_part_negative_quantity(
        self, auth_client: AsyncClient, work_order: dict
    ):
        res = await auth_client.post(
            f"/api/v1/maintenance/work-orders/{work_order['id']}/parts",
            json={"part_number": "X", "name": "Bad", "quantity": -1, "unit_cost": 5.0},
        )
        assert res.status_code == 422

    async def test_add_part_zero_cost(
        self, auth_client: AsyncClient, work_order: dict
    ):
        """Zero unit_cost should be valid (warranty/no-cost parts)."""
        res = await auth_client.post(
            f"/api/v1/maintenance/work-orders/{work_order['id']}/parts",
            json={"part_number": "WRT-001", "name": "Warranty Part", "quantity": 1, "unit_cost": 0},
        )
        assert res.status_code == 201

    async def test_add_part_to_nonexistent_work_order(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.post(
            "/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000/parts",
            json={"part_number": "X", "name": "Ghost", "quantity": 1, "unit_cost": 1.0},
        )
        assert res.status_code == 404

    async def test_delete_part_from_work_order(
        self, auth_client: AsyncClient, work_order_with_part: dict
    ):
        wo_id = work_order_with_part["id"]
        part_id = work_order_with_part["parts"][0]["id"]

        res = await auth_client.delete(
            f"/api/v1/maintenance/work-orders/{wo_id}/parts/{part_id}"
        )
        assert res.status_code in (200, 204)

        # Confirm removed
        wo_res = await auth_client.get(f"/api/v1/maintenance/work-orders/{wo_id}")
        remaining_ids = [p["id"] for p in wo_res.json()["data"]["parts"]]
        assert part_id not in remaining_ids

    async def test_delete_nonexistent_part(
        self, auth_client: AsyncClient, work_order: dict
    ):
        res = await auth_client.delete(
            f"/api/v1/maintenance/work-orders/{work_order['id']}/parts"
            "/00000000-0000-0000-0000-000000000000"
        )
        assert res.status_code == 404

    async def test_parts_require_auth(
        self, client: AsyncClient, work_order: dict
    ):
        res = await client.post(
            f"/api/v1/maintenance/work-orders/{work_order['id']}/parts",
            json={"part_number": "X", "name": "Unauth", "quantity": 1, "unit_cost": 1.0},
        )
        assert res.status_code == 401