"""
tests/integration/test_rbac.py
Fleet Management System

Cross-cutting RBAC tests. Each class covers ONE domain endpoint and
asserts the full permission matrix: who can read, who can write, who
is blocked. Functional correctness (payload details, response shapes)
lives in the domain-specific test files. This file only cares about
HTTP status codes that indicate permission decisions.

Role matrix (column = role, row = action):
                    ADMIN  DISPATCHER  MECHANIC  FINANCE  DRIVER
────────────────────────────────────────────────────────────────
Trucks CRUD         RW     R           RW        R        R
Trailers CRUD       RW     R           RW        R        R
Drivers CRUD        RW     R           R         R        R
Trips CRUD          RW     RW          R         R        R(own)
Work Orders CRUD    RW     R           RW        R        —
Service Schedules   RW     R           RW        R        —
Fuel Logs           RW     —           R         RW       W(own)
Expenses            RW     —           —         RW       —
Settings PATCH      W      —           —         —        —
Settings GET        R      R           R         R        R
────────────────────────────────────────────────────────────────

Note: — means 403, R = read-only (GET 200), W = write-only, RW = full.
"""

import pytest
from httpx import AsyncClient

NULL_UUID = "00000000-0000-0000-0000-000000000000"


# ─────────────────────────────────────────────────────────────────────────────
# TRUCKS — /api/v1/fleet/trucks
# ─────────────────────────────────────────────────────────────────────────────

class TestTruckRBAC:
    """
    ADMIN and MECHANIC can create/update/delete trucks.
    DISPATCHER, FINANCE, DRIVER can only list/read.
    """

    async def test_dispatcher_can_list_trucks(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.get("/api/v1/fleet/trucks")
        assert res.status_code == 200

    async def test_dispatcher_cannot_create_truck(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.post(
            "/api/v1/fleet/trucks",
            json={"plate_number": "RBAC-001", "make": "X", "model": "Y", "year": 2020},
        )
        assert res.status_code == 403

    async def test_finance_cannot_create_truck(self, finance_client: AsyncClient):
        res = await finance_client.post(
            "/api/v1/fleet/trucks",
            json={"plate_number": "RBAC-002", "make": "X", "model": "Y", "year": 2020},
        )
        assert res.status_code == 403

    async def test_driver_cannot_create_truck(self, driver_client: AsyncClient):
        res = await driver_client.post(
            "/api/v1/fleet/trucks",
            json={"plate_number": "RBAC-003", "make": "X", "model": "Y", "year": 2020},
        )
        assert res.status_code == 403

    async def test_mechanic_cannot_create_truck(self, auth_client: AsyncClient):
        """auth_client is MECHANIC — should not be allowed to create trucks."""
        import uuid
        plate = f"MEC-{uuid.uuid4().hex[:6].upper()}"
        res = await auth_client.post(
            "/api/v1/fleet/trucks",
            json={"plate_number": plate, "make": "Test", "model": "Rig", "year": 2023},
        )
        assert res.status_code == 403

    async def test_unauthenticated_cannot_list_trucks(self, client: AsyncClient):
        res = await client.get("/api/v1/fleet/trucks")
        assert res.status_code == 401

    async def test_dispatcher_cannot_delete_truck(
        self, dispatcher_client: AsyncClient, sample_truck_id: str
    ):
        res = await dispatcher_client.delete(f"/api/v1/fleet/trucks/{sample_truck_id}")
        assert res.status_code == 403

    async def test_admin_can_delete_truck(
        self, admin_client: AsyncClient, sample_truck_id: str
    ):
        res = await admin_client.delete(f"/api/v1/fleet/trucks/{sample_truck_id}")
        assert res.status_code in (200, 204)


# ─────────────────────────────────────────────────────────────────────────────
# DRIVERS — /api/v1/drivers
# ─────────────────────────────────────────────────────────────────────────────

class TestDriverRBAC:
    """
    ADMIN and DISPATCHER can read driver profiles.
    Only ADMIN can create or delete driver records.
    MECHANIC and FINANCE can read but not write.
    """

    async def test_admin_can_list_drivers(self, admin_client: AsyncClient):
        res = await admin_client.get("/api/v1/drivers")
        assert res.status_code == 200

    async def test_mechanic_can_list_drivers(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/v1/drivers")
        assert res.status_code == 200

    async def test_mechanic_cannot_create_driver(
        self, auth_client: AsyncClient, driver_user_id: str
    ):
        import uuid
        res = await auth_client.post(
            "/api/v1/drivers",
            json={
                "user_id": driver_user_id,
                "first_name": "Unauthorized",
                "last_name": "Driver",
                "email": "unauth@test.com",
                "phone": "+254799999999",
                "license_number": f"RBAC-{uuid.uuid4().hex[:8].upper()}",
                "license_class": "C",
                "license_expiry_date": "2027-01-01T00:00:00Z",
                "hire_date": "2024-01-01T00:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_finance_cannot_delete_driver(
        self, finance_client: AsyncClient, sample_driver: dict
    ):
        res = await finance_client.delete(f"/api/v1/drivers/{sample_driver['id']}")
        assert res.status_code == 403

    async def test_unauthenticated_cannot_access_drivers(
        self, client: AsyncClient
    ):
        res = await client.get("/api/v1/drivers")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# TRIPS — /api/v1/trips
# ─────────────────────────────────────────────────────────────────────────────

class TestTripRBAC:
    """
    Only DISPATCHER (and ADMIN) can create or update trips.
    All authenticated roles can read trips.
    """

    async def test_dispatcher_can_create_trip(
        self, dispatcher_client: AsyncClient, sample_truck_id: str, sample_driver: dict
    ):
        res = await dispatcher_client.post(
            "/api/v1/trips",
            json={
                "origin": "Nairobi",
                "destination": "Kisumu",
                "scheduled_departure": "2025-10-01T07:00:00Z",
                "scheduled_arrival": "2025-10-01T14:00:00Z",
                "assigned_truck_id": sample_truck_id,
                "assigned_driver_id": sample_driver["id"],
            },
        )
        assert res.status_code == 201

    async def test_mechanic_cannot_create_trip(
        self, auth_client: AsyncClient, sample_truck_id: str, sample_driver: dict
    ):
        res = await auth_client.post(
            "/api/v1/trips",
            json={
                "origin": "Nairobi",
                "destination": "Nakuru",
                "scheduled_departure": "2025-10-02T07:00:00Z",
                "scheduled_arrival": "2025-10-02T12:00:00Z",
                "assigned_truck_id": sample_truck_id,
                "assigned_driver_id": sample_driver["id"],
            },
        )
        assert res.status_code == 403

    async def test_finance_cannot_create_trip(
        self, finance_client: AsyncClient, sample_truck_id: str, sample_driver: dict
    ):
        res = await finance_client.post(
            "/api/v1/trips",
            json={
                "origin": "Nairobi",
                "destination": "Eldoret",
                "scheduled_departure": "2025-10-03T07:00:00Z",
                "scheduled_arrival": "2025-10-03T13:00:00Z",
                "assigned_truck_id": sample_truck_id,
                "assigned_driver_id": sample_driver["id"],
            },
        )
        assert res.status_code == 403

    async def test_mechanic_can_read_trips(
        self, auth_client: AsyncClient, sample_trip: dict
    ):
        res = await auth_client.get("/api/v1/trips")
        assert res.status_code == 200

    async def test_driver_can_read_trips(
        self, driver_client: AsyncClient, sample_trip: dict
    ):
        res = await driver_client.get("/api/v1/trips")
        assert res.status_code == 200

    async def test_mechanic_cannot_change_trip_status(
        self, auth_client: AsyncClient, sample_trip: dict
    ):
        res = await auth_client.patch(
            f"/api/v1/trips/{sample_trip['id']}/status",
            json={"status": "en-route"},
        )
        assert res.status_code == 403

    async def test_unauthenticated_cannot_list_trips(self, client: AsyncClient):
        res = await client.get("/api/v1/trips")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# WORK ORDERS — /api/v1/maintenance/work-orders
# ─────────────────────────────────────────────────────────────────────────────

class TestWorkOrderRBAC:
    """
    MECHANIC (and ADMIN) can create/update work orders.
    DISPATCHER, FINANCE, DRIVER have no write access.
    All authenticated roles can read.
    """

    async def test_dispatcher_cannot_create_work_order(
        self,
        dispatcher_client: AsyncClient,
        sample_truck_id: str,
        mechanic_user_id: str,
    ):
        res = await dispatcher_client.post(
            "/api/v1/maintenance/work-orders",
            json={
                "truck_id": sample_truck_id,
                "assigned_mechanic_id": mechanic_user_id,
                "title": "RBAC test order",
                "description": "Should be blocked",
                "priority": "low",
                "scheduled_date": "2025-11-01T09:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_finance_cannot_create_work_order(
        self,
        finance_client: AsyncClient,
        sample_truck_id: str,
        mechanic_user_id: str,
    ):
        res = await finance_client.post(
            "/api/v1/maintenance/work-orders",
            json={
                "truck_id": sample_truck_id,
                "assigned_mechanic_id": mechanic_user_id,
                "title": "RBAC test order",
                "description": "Should be blocked",
                "priority": "low",
                "scheduled_date": "2025-11-01T09:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_driver_cannot_create_work_order(
        self,
        driver_client: AsyncClient,
        sample_truck_id: str,
        mechanic_user_id: str,
    ):
        res = await driver_client.post(
            "/api/v1/maintenance/work-orders",
            json={
                "truck_id": sample_truck_id,
                "assigned_mechanic_id": mechanic_user_id,
                "title": "RBAC test order",
                "description": "Should be blocked",
                "priority": "low",
                "scheduled_date": "2025-11-01T09:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_dispatcher_can_read_work_orders(
        self, dispatcher_client: AsyncClient, work_order: dict
    ):
        res = await dispatcher_client.get("/api/v1/maintenance/work-orders")
        assert res.status_code == 200

    async def test_finance_can_read_work_orders(
        self, finance_client: AsyncClient, work_order: dict
    ):
        res = await finance_client.get("/api/v1/maintenance/work-orders")
        assert res.status_code == 200

    async def test_mechanic_cannot_delete_work_order(
        self, auth_client: AsyncClient, work_order: dict
    ):
        """Mechanics can update but not delete work orders."""
        res = await auth_client.delete(
            f"/api/v1/maintenance/work-orders/{work_order['id']}"
        )
        assert res.status_code == 403

    async def test_admin_can_delete_work_order(
        self, admin_client: AsyncClient, work_order: dict
    ):
        res = await admin_client.delete(
            f"/api/v1/maintenance/work-orders/{work_order['id']}"
        )
        assert res.status_code in (200, 204)

    async def test_unauthenticated_cannot_list_work_orders(
        self, client: AsyncClient
    ):
        res = await client.get("/api/v1/maintenance/work-orders")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# FUEL LOGS — /api/v1/fuel
# ─────────────────────────────────────────────────────────────────────────────

class TestFuelLogRBAC:
    """
    FINANCE and DRIVER (own records) can log fuel.
    MECHANIC and DISPATCHER can only read.
    """

    async def test_finance_can_create_fuel_log(
        self,
        finance_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        res = await finance_client.post(
            "/api/v1/fuel",
            json={
                "truck_id": sample_truck_id,
                "driver_id": sample_driver["id"],
                "litres": 60.0,
                "price_per_litre": 1.50,
                "total_cost": 90.0,
                "odometer_at_fuel": 55000.0,
                "logged_at": "2025-07-01T10:00:00Z",
            },
        )
        assert res.status_code == 201

    async def test_dispatcher_cannot_create_fuel_log(
        self,
        dispatcher_client: AsyncClient,
        sample_truck_id: str,
        sample_driver: dict,
    ):
        res = await dispatcher_client.post(
            "/api/v1/fuel",
            json={
                "truck_id": sample_truck_id,
                "driver_id": sample_driver["id"],
                "litres": 40.0,
                "price_per_litre": 1.50,
                "total_cost": 60.0,
                "odometer_at_fuel": 56000.0,
                "logged_at": "2025-07-02T10:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_mechanic_can_read_fuel_logs(
        self, auth_client: AsyncClient, sample_fuel_log: dict
    ):
        res = await auth_client.get("/api/v1/fuel")
        assert res.status_code == 200

    async def test_unauthenticated_cannot_access_fuel_logs(
        self, client: AsyncClient
    ):
        res = await client.get("/api/v1/fuel")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES — /api/v1/expenses
# ─────────────────────────────────────────────────────────────────────────────

class TestExpenseRBAC:
    """
    FINANCE (and ADMIN) can create/update/delete expenses.
    All other authenticated roles can only read.
    """

    async def test_finance_can_create_expense(
        self, finance_client: AsyncClient, sample_truck_id: str
    ):
        res = await finance_client.post(
            "/api/v1/expenses",
            json={
                "category": "tolls",
                "amount": 350.00,
                "currency": "KES",
                "description": "Nairobi bypass toll",
                "truck_id": sample_truck_id,
                "expense_date": "2025-06-20T00:00:00Z",
            },
        )
        assert res.status_code == 201

    async def test_mechanic_cannot_create_expense(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.post(
            "/api/v1/expenses",
            json={
                "category": "maintenance",
                "amount": 1000.00,
                "currency": "KES",
                "description": "Parts",
                "truck_id": sample_truck_id,
                "expense_date": "2025-06-21T00:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_dispatcher_cannot_create_expense(
        self, dispatcher_client: AsyncClient, sample_truck_id: str
    ):
        res = await dispatcher_client.post(
            "/api/v1/expenses",
            json={
                "category": "tolls",
                "amount": 200.00,
                "currency": "KES",
                "description": "Toll fee",
                "truck_id": sample_truck_id,
                "expense_date": "2025-06-22T00:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_driver_cannot_create_expense(
        self, driver_client: AsyncClient, sample_truck_id: str
    ):
        res = await driver_client.post(
            "/api/v1/expenses",
            json={
                "category": "other",
                "amount": 100.00,
                "currency": "KES",
                "description": "Misc",
                "truck_id": sample_truck_id,
                "expense_date": "2025-06-23T00:00:00Z",
            },
        )
        assert res.status_code == 403

    async def test_admin_can_delete_expense(
        self, admin_client: AsyncClient, sample_expense: dict
    ):
        res = await admin_client.delete(f"/api/v1/expenses/{sample_expense['id']}")
        assert res.status_code in (200, 204)

    async def test_finance_cannot_access_expenses_unauthenticated(
        self, client: AsyncClient
    ):
        res = await client.get("/api/v1/expenses")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# SETTINGS — /api/v1/settings/system
# ─────────────────────────────────────────────────────────────────────────────

class TestSettingsRBAC:
    """
    All roles can GET. Only ADMIN can PATCH.
    """

    async def test_all_roles_can_read_settings(
        self,
        auth_client: AsyncClient,
        admin_client: AsyncClient,
        dispatcher_client: AsyncClient,
        finance_client: AsyncClient,
        driver_client: AsyncClient,
    ):
        for name, c in [
            ("mechanic", auth_client),
            ("admin", admin_client),
            ("dispatcher", dispatcher_client),
            ("finance", finance_client),
            ("driver", driver_client),
        ]:
            res = await c.get("/api/v1/settings/system")
            assert res.status_code == 200, (
                f"{name} should be able to read settings, got {res.status_code}"
            )

    async def test_only_admin_can_patch_settings(
        self,
        admin_client: AsyncClient,
        auth_client: AsyncClient,
        dispatcher_client: AsyncClient,
        finance_client: AsyncClient,
        driver_client: AsyncClient,
    ):
        patch_payload = {"org_name": "RBAC Test Co"}

        assert (
            await admin_client.patch("/api/v1/settings/system", json=patch_payload)
        ).status_code == 200

        for name, c in [
            ("mechanic", auth_client),
            ("dispatcher", dispatcher_client),
            ("finance", finance_client),
            ("driver", driver_client),
        ]:
            res = await c.patch("/api/v1/settings/system", json=patch_payload)
            assert res.status_code == 403, (
                f"{name} should be blocked from PATCH settings, got {res.status_code}"
            )