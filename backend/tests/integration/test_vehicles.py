"""
tests/integration/test_vehicles.py
Fleet Management System

Covers: /api/v1/fleet/trucks  and  /api/v1/fleet/trailers
        /api/v1/fleet/summary

RBAC (from fleet router):
  ViewerDep  → ADMIN, DISPATCHER, MECHANIC, FINANCE, DRIVER  (GET)
  AdminDep   → ADMIN only                                     (POST, PATCH, DELETE)

Response shape:
  Single item  → TruckResponse / TrailerResponse directly (no ApiResponse wrapper)
  List         → PaginatedResponse: { "data": [...], "meta": {...} }
  Summary      → FleetSummary directly

CamelCase field mapping (TruckResponse):
  plate_number  → plateNumber
  odometer_km   → odometerKm
  fuel_type     → fuelType
  created_at    → createdAt
  updated_at    → updatedAt

CamelCase field mapping (TrailerResponse):
  plate_number  → plateNumber
  capacity_tons → capacityTons
  created_at    → createdAt
"""

import uuid
import pytest
from httpx import AsyncClient

NULL_UUID = "00000000-0000-0000-0000-000000000000"


def _unique_plate(prefix: str = "TST") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


# ─────────────────────────────────────────────────────────────────────────────
# TRUCKS — CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateTruck:

    async def test_create_truck_success(self, admin_client: AsyncClient):
        plate = _unique_plate("NEW")
        payload = {
            "plate_number": plate,
            "make": "Mercedes",
            "model": "Actros",
            "year": 2023,
            "fuel_type": "diesel",
            "status": "active",
            "odometer_km": 0.0,
        }
        res = await admin_client.post("/api/v1/fleet/trucks", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["plateNumber"] == plate
        assert data["make"] == "Mercedes"
        assert data["model"] == "Actros"
        assert data["year"] == 2023
        assert data["fuelType"] == "diesel"
        assert data["status"] == "active"
        assert "id" in data

    async def test_create_truck_with_optional_fields(self, admin_client: AsyncClient):
        payload = {
            "plate_number": _unique_plate("OPT"),
            "make": "Volvo",
            "model": "FH16",
            "year": 2022,
            "fuel_type": "diesel",
            "status": "active",
            "odometer_km": 12000.0,
            "vin": "YV2RT40A8YB123456",
            "color": "White",
            "wheel_config": "6x4",
            "gross_weight_tons": 25.0,
            "axle_load_tons": 10.0,
        }
        res = await admin_client.post("/api/v1/fleet/trucks", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["vin"] == "YV2RT40A8YB123456"
        assert data["color"] == "White"
        assert data["wheelConfig"] == "6x4"
        assert data["grossWeightTons"] == 25.0

    async def test_create_truck_missing_required_fields(self, admin_client: AsyncClient):
        """Omit plate_number — required field."""
        res = await admin_client.post(
            "/api/v1/fleet/trucks",
            json={"make": "Ford", "model": "Transit", "year": 2021},
        )
        assert res.status_code == 422

    async def test_create_truck_duplicate_plate(self, admin_client: AsyncClient):
        """Posting the same plate twice must be rejected."""
        plate = _unique_plate("DUP")
        payload = {
            "plate_number": plate,
            "make": "Isuzu",
            "model": "NQR",
            "year": 2021,
            "fuel_type": "diesel",
            "status": "active",
            "odometer_km": 0.0,
        }
        first = await admin_client.post("/api/v1/fleet/trucks", json=payload)
        assert first.status_code == 201

        second = await admin_client.post("/api/v1/fleet/trucks", json=payload)
        assert second.status_code == 409

    async def test_create_truck_invalid_fuel_type(self, admin_client: AsyncClient):
        res = await admin_client.post(
            "/api/v1/fleet/trucks",
            json={
                "plate_number": _unique_plate("INV"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "fuel_type": "steam",
                "status": "active",
                "odometer_km": 0.0,
            },
        )
        assert res.status_code == 422

    async def test_create_truck_invalid_status(self, admin_client: AsyncClient):
        res = await admin_client.post(
            "/api/v1/fleet/trucks",
            json={
                "plate_number": _unique_plate("INV"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "fuel_type": "diesel",
                "status": "flying",
                "odometer_km": 0.0,
            },
        )
        assert res.status_code == 422

    async def test_create_truck_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/fleet/trucks",
            json={
                "plate_number": _unique_plate("ANON"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "fuel_type": "diesel",
                "status": "active",
                "odometer_km": 0.0,
            },
        )
        assert res.status_code == 401

    async def test_create_truck_requires_admin(self, auth_client: AsyncClient):
        """MECHANIC role must be forbidden from creating trucks."""
        res = await auth_client.post(
            "/api/v1/fleet/trucks",
            json={
                "plate_number": _unique_plate("MEC"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "fuel_type": "diesel",
                "status": "active",
                "odometer_km": 0.0,
            },
        )
        assert res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# TRUCKS — READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetTrucks:

    async def test_list_trucks(self, auth_client: AsyncClient, sample_truck_id: str):
        res = await auth_client.get("/api/v1/fleet/trucks")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)
        meta = body["meta"]
        assert "totalItems" in meta
        assert "page" in meta
        assert "pageSize" in meta

    async def test_list_trucks_filter_by_status(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.get(
            "/api/v1/fleet/trucks", params={"status": "active"}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["status"] == "active"

    async def test_list_trucks_search_by_plate(
        self, admin_client: AsyncClient
    ):
        """Create a truck with a known plate then verify search finds it."""
        plate = _unique_plate("SRC")
        await admin_client.post(
            "/api/v1/fleet/trucks",
            json={
                "plate_number": plate,
                "make": "Hino",
                "model": "300",
                "year": 2020,
                "fuel_type": "diesel",
                "status": "active",
                "odometer_km": 0.0,
            },
        )
        res = await admin_client.get(
            "/api/v1/fleet/trucks", params={"search": plate}
        )
        assert res.status_code == 200
        plates = [t["plateNumber"] for t in res.json()["data"]]
        assert plate in plates

    async def test_list_trucks_pagination(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.get(
            "/api/v1/fleet/trucks", params={"page": 1, "page_size": 1}
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 1
        assert body["meta"]["pageSize"] == 1

    async def test_get_single_truck(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.get(f"/api/v1/fleet/trucks/{sample_truck_id}")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == sample_truck_id

    async def test_get_nonexistent_truck(self, auth_client: AsyncClient):
        res = await auth_client.get(f"/api/v1/fleet/trucks/{NULL_UUID}")
        assert res.status_code == 404

    async def test_list_trucks_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/fleet/trucks")
        assert res.status_code == 401

    async def test_dispatcher_can_list_trucks(
        self, dispatcher_client: AsyncClient, sample_truck_id: str
    ):
        res = await dispatcher_client.get("/api/v1/fleet/trucks")
        assert res.status_code == 200

    async def test_finance_can_list_trucks(
        self, finance_client: AsyncClient, sample_truck_id: str
    ):
        res = await finance_client.get("/api/v1/fleet/trucks")
        assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# TRUCKS — UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateTruck:

    async def test_update_truck_fields(
        self, admin_client: AsyncClient, sample_truck_id: str
    ):
        res = await admin_client.patch(
            f"/api/v1/fleet/trucks/{sample_truck_id}",
            json={"color": "Red", "notes": "Repainted"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["color"] == "Red"
        assert data["notes"] == "Repainted"

    async def test_update_truck_status(
        self, admin_client: AsyncClient, sample_truck_id: str
    ):
        """
        TruckStatusEnum: active | inactive | in-progress | under-maintenance
        Note the hyphens — must match the enum exactly.
        """
        res = await admin_client.patch(
            f"/api/v1/fleet/trucks/{sample_truck_id}",
            json={"status": "under-maintenance"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "under-maintenance"

    async def test_update_truck_odometer(
        self, admin_client: AsyncClient, sample_truck_id: str
    ):
        res = await admin_client.patch(
            f"/api/v1/fleet/trucks/{sample_truck_id}",
            json={"odometer_km": 75000.0},
        )
        assert res.status_code == 200
        assert res.json()["data"]["odometerKm"] == 75000.0

    async def test_partial_update_preserves_other_fields(
        self, admin_client: AsyncClient, sample_truck_id: str
    ):
        """PATCH must not wipe fields that are not included in the payload."""
        original = (
            await admin_client.get(f"/api/v1/fleet/trucks/{sample_truck_id}")
        ).json()["data"]
        original_make = original["make"]

        await admin_client.patch(
            f"/api/v1/fleet/trucks/{sample_truck_id}",
            json={"color": "Blue"},
        )
        refetched = (
            await admin_client.get(f"/api/v1/fleet/trucks/{sample_truck_id}")
        ).json()["data"]
        assert refetched["make"] == original_make
        assert refetched["color"] == "Blue"

    async def test_update_nonexistent_truck(self, admin_client: AsyncClient):
        res = await admin_client.patch(
            f"/api/v1/fleet/trucks/{NULL_UUID}", json={"color": "Green"}
        )
        assert res.status_code == 404

    async def test_update_truck_requires_admin(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.patch(
            f"/api/v1/fleet/trucks/{sample_truck_id}", json={"color": "Yellow"}
        )
        assert res.status_code == 403

    async def test_update_truck_requires_auth(
        self, client: AsyncClient, sample_truck_id: str
    ):
        res = await client.patch(
            f"/api/v1/fleet/trucks/{sample_truck_id}", json={"color": "White"}
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# TRUCKS — DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteTruck:

    async def test_delete_truck(self, admin_client: AsyncClient):
        """Create a truck then delete it — subsequent GET must 404."""
        plate = _unique_plate("DEL")
        created = await admin_client.post(
            "/api/v1/fleet/trucks",
            json={
                "plate_number": plate,
                "make": "Mitsubishi",
                "model": "Canter",
                "year": 2019,
                "fuel_type": "diesel",
                "status": "active",
                "odometer_km": 0.0,
            },
        )
        assert created.status_code == 201
        truck_id = created.json()["data"]["id"]

        res = await admin_client.delete(f"/api/v1/fleet/trucks/{truck_id}")
        assert res.status_code == 204

        get_res = await admin_client.get(f"/api/v1/fleet/trucks/{truck_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_truck(self, admin_client: AsyncClient):
        res = await admin_client.delete(f"/api/v1/fleet/trucks/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_truck_requires_admin(
        self, auth_client: AsyncClient, sample_truck_id: str
    ):
        res = await auth_client.delete(f"/api/v1/fleet/trucks/{sample_truck_id}")
        assert res.status_code == 403

    async def test_delete_truck_requires_auth(
        self, client: AsyncClient, sample_truck_id: str
    ):
        res = await client.delete(f"/api/v1/fleet/trucks/{sample_truck_id}")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# TRAILERS — CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateTrailer:

    async def test_create_trailer_success(self, admin_client: AsyncClient):
        payload = {
            "plate_number": _unique_plate("TRL"),
            "make": "Schmitz",
            "model": "S.CS",
            "year": 2021,
            "type": "flatbed",
            "status": "active",
        }
        res = await admin_client.post("/api/v1/fleet/trailers", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["type"] == "flatbed"
        assert data["status"] == "active"
        assert "id" in data

    async def test_create_trailer_all_types(self, admin_client: AsyncClient):
        """
        TrailerTypeEnum: flatbed | refrigerated | tanker | box | other
        Spot-check two types beyond the default.
        """
        for trailer_type in ("refrigerated", "tanker"):
            res = await admin_client.post(
                "/api/v1/fleet/trailers",
                json={
                    "plate_number": _unique_plate(trailer_type[:3].upper()),
                    "make": "Krone",
                    "model": "Cool",
                    "year": 2022,
                    "type": trailer_type,
                    "status": "active",
                },
            )
            assert res.status_code == 201, (
                f"Expected 201 for type={trailer_type}, got {res.status_code}: {res.text}"
            )

    async def test_create_trailer_with_optional_fields(
        self, admin_client: AsyncClient
    ):
        res = await admin_client.post(
            "/api/v1/fleet/trailers",
            json={
                "plate_number": _unique_plate("OPT"),
                "make": "Wielton",
                "model": "NW",
                "year": 2020,
                "type": "box",
                "status": "active",
                "capacity_tons": 30.0,
                "axles": 3,
            },
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["capacityTons"] == 30.0
        assert data["axles"] == 3

    async def test_create_trailer_missing_type(self, admin_client: AsyncClient):
        """type is required — TrailerBase has no default for it."""
        res = await admin_client.post(
            "/api/v1/fleet/trailers",
            json={
                "plate_number": _unique_plate("NT"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "status": "active",
            },
        )
        assert res.status_code == 422

    async def test_create_trailer_invalid_type(self, admin_client: AsyncClient):
        res = await admin_client.post(
            "/api/v1/fleet/trailers",
            json={
                "plate_number": _unique_plate("IT"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "type": "flying_saucer",
                "status": "active",
            },
        )
        assert res.status_code == 422

    async def test_create_trailer_duplicate_plate(
        self, admin_client: AsyncClient
    ):
        plate = _unique_plate("DUP")
        payload = {
            "plate_number": plate,
            "make": "X",
            "model": "Y",
            "year": 2020,
            "type": "flatbed",
            "status": "active",
        }
        first = await admin_client.post("/api/v1/fleet/trailers", json=payload)
        assert first.status_code == 201

        second = await admin_client.post("/api/v1/fleet/trailers", json=payload)
        assert second.status_code == 409

    async def test_create_trailer_requires_admin(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.post(
            "/api/v1/fleet/trailers",
            json={
                "plate_number": _unique_plate("MEC"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "type": "flatbed",
                "status": "active",
            },
        )
        assert res.status_code == 403

    async def test_create_trailer_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/fleet/trailers",
            json={
                "plate_number": _unique_plate("AN"),
                "make": "X",
                "model": "Y",
                "year": 2020,
                "type": "flatbed",
                "status": "active",
            },
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# TRAILERS — READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetTrailers:

    async def test_list_trailers(
        self, auth_client: AsyncClient, sample_trailer_id: str
    ):
        res = await auth_client.get("/api/v1/fleet/trailers")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_trailers_filter_by_status(
        self, auth_client: AsyncClient, sample_trailer_id: str
    ):
        res = await auth_client.get(
            "/api/v1/fleet/trailers", params={"status": "active"}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["status"] == "active"

    async def test_list_trailers_pagination(
        self, auth_client: AsyncClient, sample_trailer_id: str
    ):
        res = await auth_client.get(
            "/api/v1/fleet/trailers", params={"page": 1, "page_size": 1}
        )
        assert res.status_code == 200
        assert len(res.json()["data"]) <= 1

    async def test_get_single_trailer(
        self, auth_client: AsyncClient, sample_trailer_id: str
    ):
        res = await auth_client.get(f"/api/v1/fleet/trailers/{sample_trailer_id}")

        assert res.status_code == 200
        assert res.json()["data"]["id"] == sample_trailer_id

    async def test_get_nonexistent_trailer(self, auth_client: AsyncClient):
        res = await auth_client.get(f"/api/v1/fleet/trailers/{NULL_UUID}")
        assert res.status_code == 404

    async def test_list_trailers_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/fleet/trailers")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# TRAILERS — UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateTrailer:

    async def test_update_trailer_fields(
        self, admin_client: AsyncClient, sample_trailer_id: str
    ):
        res = await admin_client.patch(
            f"/api/v1/fleet/trailers/{sample_trailer_id}",
            json={"capacity_tons": 35.0, "notes": "Reinforced floor"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["capacityTons"] == 35.0
        assert data["notes"] == "Reinforced floor"

    async def test_update_trailer_status(
        self, admin_client: AsyncClient, sample_trailer_id: str
    ):
        """
        TrailerStatusEnum: active | inactive | under-maintenance
        """
        res = await admin_client.patch(
            f"/api/v1/fleet/trailers/{sample_trailer_id}",
            json={"status": "under-maintenance"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "under-maintenance"

    async def test_partial_update_preserves_other_fields(
        self, admin_client: AsyncClient, sample_trailer_id: str
    ):
        original_make = (
            await admin_client.get(f"/api/v1/fleet/trailers/{sample_trailer_id}")
        ).json()["data"]["make"]

        await admin_client.patch(
            f"/api/v1/fleet/trailers/{sample_trailer_id}",
            json={"axles": 2},
        )
        refetched = (
            await admin_client.get(f"/api/v1/fleet/trailers/{sample_trailer_id}")
        ).json()["data"]
        assert refetched["make"] == original_make
        assert refetched["axles"] == 2

    async def test_update_nonexistent_trailer(self, admin_client: AsyncClient):
        res = await admin_client.patch(
            f"/api/v1/fleet/trailers/{NULL_UUID}", json={"notes": "Ghost"}
        )
        assert res.status_code == 404

    async def test_update_trailer_requires_admin(
        self, auth_client: AsyncClient, sample_trailer_id: str
    ):
        res = await auth_client.patch(
            f"/api/v1/fleet/trailers/{sample_trailer_id}", json={"notes": "No"}
        )
        assert res.status_code == 403

    async def test_update_trailer_requires_auth(
        self, client: AsyncClient, sample_trailer_id: str
    ):
        res = await client.patch(
            f"/api/v1/fleet/trailers/{sample_trailer_id}", json={"notes": "No"}
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# TRAILERS — DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteTrailer:

    async def test_delete_trailer(self, admin_client: AsyncClient):
        plate = _unique_plate("DLT")
        created = await admin_client.post(
            "/api/v1/fleet/trailers",
            json={
                "plate_number": plate,
                "make": "Kögel",
                "model": "S24",
                "year": 2020,
                "type": "box",
                "status": "active",
            },
        )
        assert created.status_code == 201
        trailer_id = created.json()["data"]["id"]

        res = await admin_client.delete(f"/api/v1/fleet/trailers/{trailer_id}")
        assert res.status_code == 204

        get_res = await admin_client.get(f"/api/v1/fleet/trailers/{trailer_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_trailer(self, admin_client: AsyncClient):
        res = await admin_client.delete(f"/api/v1/fleet/trailers/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_trailer_requires_admin(
        self, auth_client: AsyncClient, sample_trailer_id: str
    ):
        res = await auth_client.delete(
            f"/api/v1/fleet/trailers/{sample_trailer_id}"
        )
        assert res.status_code == 403

    async def test_delete_trailer_requires_auth(
        self, client: AsyncClient, sample_trailer_id: str
    ):
        res = await client.delete(f"/api/v1/fleet/trailers/{sample_trailer_id}")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# FLEET SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

class TestFleetSummary:

    async def test_fleet_summary_returns_expected_keys(
        self, auth_client: AsyncClient, sample_truck_id: str, sample_trailer_id: str
    ):
        res = await auth_client.get("/api/v1/fleet/summary")

        assert res.status_code == 200
        data = res.json()
        # FleetSummary fields (camelCase)
        for key in (
            "totalTrucks",
            "activeTrucks",
            "inProgressTrucks",
            "inactiveTrucks",
            "totalTrailers",
            "activeTrailers",
            "inactiveTrailers",
        ):
            assert key in data, f"Missing key: {key}"

    async def test_fleet_summary_counts_are_non_negative(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.get("/api/v1/fleet/summary")
        assert res.status_code == 200
        data = res.json()
        for key, value in data.items():
            if isinstance(value, (int, float)):
                assert value >= 0, f"{key} should not be negative"

    async def test_fleet_summary_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/fleet/summary")
        assert res.status_code == 401