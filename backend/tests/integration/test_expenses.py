"""
tests/integration/test_expenses.py
Fleet Management System

Covers: /api/v1/fuel/expenses  (Expense CRUD)

NOTE on endpoint path:
  The schema comment says POST /fuel/expenses, so the full path
  is /api/v1/fuel/expenses. If the router uses a different sub-path
  update the BASE constant below.

RBAC (from schema comments):
  POST /api/v1/fuel/expenses          → ADMIN, FINANCE
  GET  /api/v1/fuel/expenses          → all authenticated roles
  PATCH /api/v1/fuel/expenses/{id}    → ADMIN, FINANCE
  DELETE /api/v1/fuel/expenses/{id}   → ADMIN, FINANCE

CamelCase field mapping (ExpenseResponse):
  expense_date    → expenseDate
  truck_id        → truckId
  driver_id       → driverId
  trip_id         → tripId
  receipt_url     → receiptUrl
  created_by      → createdBy
  created_at      → createdAt
  updated_at      → updatedAt
  truck_plate     → truckPlate
  driver_name     → driverName
  trip_number     → tripNumber
  created_by_name → createdByName

ExpenseCategoryEnum:
  fuel | maintenance | tolls | tyres | insurance | licensing | salary | other

NOTE: ExpenseBase.amount has Field(..., gt=0) — zero amount is NOT valid.
"""

import pytest
from httpx import AsyncClient

BASE = "/api/v1/fuel/expenses"
NULL_UUID = "00000000-0000-0000-0000-000000000000"


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateExpense:

    async def test_create_expense_success(
        self, finance_client: AsyncClient, sample_truck_id: str
    ):
        payload = {
            "category": "maintenance",
            "amount": 4500.00,
            "currency": "KES",
            "description": "Brake pad replacement",
            "truck_id": sample_truck_id,
            "expense_date": "2025-06-10T00:00:00Z",
        }
        res = await finance_client.post(BASE, json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["category"] == "maintenance"
        assert data["amount"] == 4500.00
        assert data["currency"] == "KES"
        assert data["description"] == "Brake pad replacement"
        assert data["truckId"] == sample_truck_id
        assert "id" in data
        assert "createdBy" in data

    async def test_create_expense_all_categories(
        self, finance_client: AsyncClient
    ):
        """Every ExpenseCategory value should be accepted."""
        for category in (
            "fuel", "maintenance", "tolls", "tyres",
            "insurance", "licensing", "salary", "other",
        ):
            res = await finance_client.post(
                BASE,
                json={
                    "category": category,
                    "amount": 100.00,
                    "description": f"{category} expense",
                    "expense_date": "2025-06-11T00:00:00Z",
                },
            )
            assert res.status_code == 201, (
                f"Expected 201 for category={category}: {res.text}"
            )
            assert res.json()["data"]["category"] == category

    async def test_create_expense_with_all_optional_fields(
        self,
        finance_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
        sample_trip: dict,
    ):
        payload = {
            "category": "tolls",
            "amount": 350.00,
            "currency": "KES",
            "description": "Nairobi bypass toll",
            "truck_id": sample_truck_id,
            "driver_id": sample_driver["id"],
            "trip_id": sample_trip["id"],
            "receipt_url": "https://storage.example.com/receipts/toll.pdf",
            "expense_date": "2025-06-12T00:00:00Z",
        }
        res = await finance_client.post(BASE, json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["driverId"] == sample_driver["id"]
        assert data["tripId"] == sample_trip["id"]
        assert data["receiptUrl"] is not None

    async def test_create_expense_invalid_category(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.post(
            BASE,
            json={
                "category": "snacks",
                "amount": 100.00,
                "description": "Invalid category",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_expense_zero_amount_rejected(
        self, finance_client: AsyncClient
    ):
        """ExpenseBase.amount has gt=0 — zero is explicitly invalid."""
        res = await finance_client.post(
            BASE,
            json={
                "category": "tolls",
                "amount": 0.0,
                "description": "Zero amount",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_expense_negative_amount_rejected(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.post(
            BASE,
            json={
                "category": "fuel",
                "amount": -500.0,
                "description": "Negative amount",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_expense_missing_description(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.post(
            BASE,
            json={
                "category": "fuel",
                "amount": 100.0,
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_expense_empty_description_rejected(
        self, finance_client: AsyncClient
    ):
        """description has min_length=1."""
        res = await finance_client.post(
            BASE,
            json={
                "category": "fuel",
                "amount": 100.0,
                "description": "",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 422

    async def test_create_expense_requires_finance_or_admin(
        self, auth_client: AsyncClient
    ):
        """MECHANIC must receive 403."""
        res = await auth_client.post(
            BASE,
            json={
                "category": "maintenance",
                "amount": 1000.00,
                "description": "Mechanic trying to log",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_create_expense_dispatcher_cannot_post(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.post(
            BASE,
            json={
                "category": "tolls",
                "amount": 200.0,
                "description": "Dispatcher trying to log",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_create_expense_requires_auth(self, client: AsyncClient):
        res = await client.post(
            BASE,
            json={
                "category": "fuel",
                "amount": 100.0,
                "description": "Anon",
                "expense_date": "2025-06-10T00:00:00Z",
            },
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetExpenses:

    async def test_list_expenses(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        res = await finance_client.get(BASE)

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_expenses_filter_by_category(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        res = await finance_client.get(BASE, params={"category": "maintenance"})
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["category"] == "maintenance"

    async def test_list_expenses_filter_by_truck(
        self,
        finance_client: AsyncClient,
        sample_expense: dict,
        sample_truck_id: str,
    ):
        res = await finance_client.get(BASE, params={"truck_id": sample_truck_id})
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["truckId"] == sample_truck_id

    async def test_list_expenses_pagination(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        res = await finance_client.get(BASE, params={"page": 1, "page_size": 1})
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 1
        assert body["meta"]["pageSize"] == 1

    async def test_get_single_expense(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        expense_id = sample_expense["id"]
        res = await finance_client.get(f"{BASE}/{expense_id}")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == expense_id
        assert "category" in data
        assert "amount" in data
        assert "expenseDate" in data

    async def test_get_nonexistent_expense(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.get(f"{BASE}/{NULL_UUID}")
        assert res.status_code == 404

    async def test_list_expenses_requires_auth(self, client: AsyncClient):
        res = await client.get(BASE)
        assert res.status_code == 401

    async def test_mechanic_can_read_expenses(
        self, auth_client: AsyncClient, sample_expense: dict
    ):
        res = await auth_client.get(BASE)
        assert res.status_code == 200

    async def test_dispatcher_can_read_expenses(
        self, dispatcher_client: AsyncClient, sample_expense: dict
    ):
        res = await dispatcher_client.get(BASE)
        assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateExpense:

    async def test_update_expense_amount_and_description(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        expense_id = sample_expense["id"]
        res = await finance_client.patch(
            f"{BASE}/{expense_id}",
            json={"amount": 5000.00, "description": "Updated: full brake kit"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["amount"] == 5000.00
        assert data["description"] == "Updated: full brake kit"

    async def test_update_expense_add_receipt_url(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        expense_id = sample_expense["id"]
        res = await finance_client.patch(
            f"{BASE}/{expense_id}",
            json={"receipt_url": "https://storage.example.com/receipt.pdf"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["receiptUrl"] is not None

    async def test_update_expense_change_category(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        expense_id = sample_expense["id"]
        res = await finance_client.patch(
            f"{BASE}/{expense_id}", json={"category": "tyres"}
        )
        assert res.status_code == 200
        assert res.json()["data"]["category"] == "tyres"

    async def test_partial_update_preserves_other_fields(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        expense_id = sample_expense["id"]
        original_truck_id = sample_expense["truckId"]

        await finance_client.patch(
            f"{BASE}/{expense_id}", json={"description": "Patched description"}
        )
        refetched = (
            await finance_client.get(f"{BASE}/{expense_id}")
        ).json()["data"]
        assert refetched["truckId"] == original_truck_id
        assert refetched["description"] == "Patched description"

    async def test_update_expense_zero_amount_rejected(
        self, finance_client: AsyncClient, sample_expense: dict
    ):
        res = await finance_client.patch(
            f"{BASE}/{sample_expense['id']}", json={"amount": 0.0}
        )
        assert res.status_code == 422

    async def test_update_nonexistent_expense(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.patch(
            f"{BASE}/{NULL_UUID}", json={"description": "Ghost"}
        )
        assert res.status_code == 404

    async def test_update_expense_requires_finance_or_admin(
        self, auth_client: AsyncClient, sample_expense: dict
    ):
        res = await auth_client.patch(
            f"{BASE}/{sample_expense['id']}",
            json={"description": "Mechanic trying"},
        )
        assert res.status_code == 403

    async def test_update_expense_requires_auth(
        self, client: AsyncClient, sample_expense: dict
    ):
        res = await client.patch(
            f"{BASE}/{sample_expense['id']}",
            json={"description": "Anon"},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteExpense:

    async def test_delete_expense(
        self, finance_client: AsyncClient
    ):
        """Create then delete — subsequent GET must 404."""
        created = await finance_client.post(
            BASE,
            json={
                "category": "other",
                "amount": 250.00,
                "description": "Expense to delete",
                "expense_date": "2025-07-01T00:00:00Z",
            },
        )
        assert created.status_code == 201
        expense_id = created.json()["data"]["id"]

        res = await finance_client.delete(f"{BASE}/{expense_id}")
        assert res.status_code in (200, 204)

        get_res = await finance_client.get(f"{BASE}/{expense_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_expense(
        self, finance_client: AsyncClient
    ):
        res = await finance_client.delete(f"{BASE}/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_expense_requires_finance_or_admin(
        self, auth_client: AsyncClient, sample_expense: dict
    ):
        res = await auth_client.delete(f"{BASE}/{sample_expense['id']}")
        assert res.status_code == 403

    async def test_delete_expense_requires_auth(
        self, client: AsyncClient, sample_expense: dict
    ):
        res = await client.delete(f"{BASE}/{sample_expense['id']}")
        assert res.status_code == 401

    async def test_admin_can_delete_any_expense(
        self, admin_client: AsyncClient, sample_expense: dict
    ):
        res = await admin_client.delete(f"{BASE}/{sample_expense['id']}")
        assert res.status_code in (200, 204)