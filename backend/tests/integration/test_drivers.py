"""
tests/integration/test_drivers.py
Fleet Management System

Covers: /api/v1/drivers  and  /api/v1/drivers/{id}/documents

IMPORTANT — DriverCreate schema change:
  POST /api/v1/drivers now creates a User(role=DRIVER) + Driver profile
  atomically in a single request.

  OLD (broken — do not use):
    {"user_id": "...", "first_name": ..., ...}   ← user_id was removed

  NEW (correct):
    {"first_name": ..., "temp_password": ..., ...} ← temp_password required

  The conftest `sample_driver` fixture also needs updating to match this
  new schema (send temp_password, omit user_id, use admin_client).
  Until that is fixed, any test that depends on sample_driver may fail.
  All driver creation in this file uses admin_client + new payload shape.

RBAC (inferred from schema comments):
  GET  /api/v1/drivers        → all authenticated roles
  POST /api/v1/drivers        → ADMIN only
  PATCH /api/v1/drivers/{id} → ADMIN only
  DELETE /api/v1/drivers/{id} → ADMIN only

CamelCase field mapping (DriverResponse):
  first_name           → firstName
  last_name            → lastName
  license_number       → licenseNumber
  license_class        → licenseClass
  license_expiry_date  → licenseExpiryDate
  hire_date            → hireDate
  user_id              → userId
  current_truck_id     → currentTruckId
  active_trip_id       → activeTripId
  created_at           → createdAt
  updated_at           → updatedAt
"""

import uuid
import pytest
from httpx import AsyncClient

NULL_UUID = "00000000-0000-0000-0000-000000000000"


def _driver_payload(overrides: dict | None = None) -> dict:
    """
    Return a valid DriverCreate payload.
    license_number is randomised to avoid unique-constraint collisions.
    """
    payload = {
        "first_name": "Test",
        "last_name": "Driver",
        "email": f"driver-{uuid.uuid4().hex[:8]}@fleetms.com",
        "phone": "+254711000001",
        "status": "active",
        "license_number": f"DL-{uuid.uuid4().hex[:8].upper()}",
        "license_class": "C",
        "license_expiry_date": "2027-12-31T00:00:00Z",
        "hire_date": "2023-06-01T00:00:00Z",
        "temp_password": "TempPass1!",
    }
    if overrides:
        payload.update(overrides)
    return payload


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateDriver:

    async def test_create_driver_success(self, admin_client: AsyncClient):
        payload = _driver_payload()
        res = await admin_client.post("/api/v1/drivers", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["firstName"] == payload["first_name"]
        assert data["lastName"] == payload["last_name"]
        assert data["email"] == payload["email"]
        assert data["licenseNumber"] == payload["license_number"]
        assert data["licenseClass"] == "C"
        assert data["status"] == "active"
        assert "id" in data
        assert "userId" in data  # auto-created User FK

    async def test_create_driver_with_optional_fields(
        self, admin_client: AsyncClient
    ):
        payload = _driver_payload({
            "national_id": "ID12345678",
            "address": "Nairobi, Kenya",
            "emergency_contact_name": "Jane Driver",
            "emergency_contact_phone": "+254700000099",
            "notes": "Commercial license since 2018",
        })
        res = await admin_client.post("/api/v1/drivers", json=payload)

        assert res.status_code == 201
        data = res.json()["data"]
        assert data["nationalId"] == "ID12345678"
        assert data["emergencyContactName"] == "Jane Driver"

    async def test_create_driver_missing_temp_password(
        self, admin_client: AsyncClient
    ):
        """temp_password is required — omitting it must 422."""
        payload = _driver_payload()
        del payload["temp_password"]
        res = await admin_client.post("/api/v1/drivers", json=payload)
        assert res.status_code == 422

    async def test_create_driver_short_temp_password(
        self, admin_client: AsyncClient
    ):
        """temp_password validator: min 8 characters."""
        res = await admin_client.post(
            "/api/v1/drivers",
            json=_driver_payload({"temp_password": "short"}),
        )
        assert res.status_code == 422

    async def test_create_driver_missing_license_number(
        self, admin_client: AsyncClient
    ):
        payload = _driver_payload()
        del payload["license_number"]
        res = await admin_client.post("/api/v1/drivers", json=payload)
        assert res.status_code == 422

    async def test_create_driver_duplicate_license_number(
        self, admin_client: AsyncClient
    ):
        """license_number is unique on the drivers table."""
        license_num = f"DL-DUPE-{uuid.uuid4().hex[:6].upper()}"
        payload = _driver_payload({"license_number": license_num})

        first = await admin_client.post("/api/v1/drivers", json=payload)
        assert first.status_code == 201

        # Same license, different email
        second = await admin_client.post(
            "/api/v1/drivers",
            json=_driver_payload({
                "license_number": license_num,
                "email": f"other-{uuid.uuid4().hex[:6]}@fleetms.com",
            }),
        )
        assert second.status_code == 409

    async def test_create_driver_invalid_status(
        self, admin_client: AsyncClient
    ):
        """DriverStatusEnum: active | inactive | on-leave | suspended"""
        res = await admin_client.post(
            "/api/v1/drivers",
            json=_driver_payload({"status": "flying"}),
        )
        assert res.status_code == 422

    async def test_create_driver_requires_admin(
        self, auth_client: AsyncClient
    ):
        """MECHANIC role must receive 403."""
        res = await auth_client.post(
            "/api/v1/drivers", json=_driver_payload()
        )
        assert res.status_code == 403

    async def test_create_driver_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/drivers", json=_driver_payload())
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────────────────────────────────────

class TestGetDrivers:

    async def test_list_drivers(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        res = await auth_client.get("/api/v1/drivers")

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_drivers_filter_by_status(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        res = await auth_client.get(
            "/api/v1/drivers", params={"status": "active"}
        )
        assert res.status_code == 200
        for item in res.json()["data"]:
            assert item["status"] == "active"

    async def test_list_drivers_pagination(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        res = await auth_client.get(
            "/api/v1/drivers", params={"page": 1, "page_size": 1}
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 1
        assert body["meta"]["pageSize"] == 1

    async def test_get_single_driver(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        driver_id = sample_driver["id"]
        res = await auth_client.get(f"/api/v1/drivers/{driver_id}")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == driver_id
        assert "firstName" in data
        assert "licenseNumber" in data
        assert "userId" in data

    async def test_get_nonexistent_driver(self, auth_client: AsyncClient):
        res = await auth_client.get(f"/api/v1/drivers/{NULL_UUID}")
        assert res.status_code == 404

    async def test_list_drivers_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/drivers")
        assert res.status_code == 401

    async def test_dispatcher_can_list_drivers(
        self, dispatcher_client: AsyncClient, sample_driver: dict
    ):
        res = await dispatcher_client.get("/api/v1/drivers")
        assert res.status_code == 200

    async def test_finance_can_list_drivers(
        self, finance_client: AsyncClient, sample_driver: dict
    ):
        res = await finance_client.get("/api/v1/drivers")
        assert res.status_code == 200

    async def test_driver_summary(self, admin_client: AsyncClient, sample_driver: dict):
        """
        GET /api/v1/drivers/summary → DriverSummary
        Fields: totalDrivers, activeDrivers, inactiveDrivers, expiringLicenses30d
        """
        res = await admin_client.get("/api/v1/drivers/summary")

        assert res.status_code == 200
        data = res.json()["data"]
        for key in ("totalDrivers", "activeDrivers", "inactiveDrivers", "expiringLicenses30d"):
            assert key in data, f"Missing summary key: {key}"
        assert data["totalDrivers"] >= 1


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateDriver:

    async def test_update_driver_contact_info(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        driver_id = sample_driver["id"]
        res = await admin_client.patch(
            f"/api/v1/drivers/{driver_id}",
            json={"phone": "+254722999888", "address": "Westlands, Nairobi"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["phone"] == "+254722999888"
        assert data["address"] == "Westlands, Nairobi"

    async def test_update_driver_status_to_on_leave(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        """DriverStatusEnum: active | inactive | on-leave | suspended"""
        res = await admin_client.patch(
            f"/api/v1/drivers/{sample_driver['id']}",
            json={"status": "on-leave"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "on-leave"

    async def test_update_driver_license_expiry(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        res = await admin_client.patch(
            f"/api/v1/drivers/{sample_driver['id']}",
            json={"license_expiry_date": "2030-01-01T00:00:00Z"},
        )
        assert res.status_code == 200
        assert "licenseExpiryDate" in res.json()["data"]

    async def test_partial_update_preserves_other_fields(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        driver_id = sample_driver["id"]
        original_license = sample_driver["licenseNumber"]

        await admin_client.patch(
            f"/api/v1/drivers/{driver_id}", json={"notes": "Updated notes"}
        )
        refetched = (
            await admin_client.get(f"/api/v1/drivers/{driver_id}")
        ).json()["data"]

        assert refetched["licenseNumber"] == original_license
        assert refetched["notes"] == "Updated notes"

    async def test_update_nonexistent_driver(self, admin_client: AsyncClient):
        res = await admin_client.patch(
            f"/api/v1/drivers/{NULL_UUID}", json={"notes": "Ghost"}
        )
        assert res.status_code == 404

    async def test_update_driver_requires_admin(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        res = await auth_client.patch(
            f"/api/v1/drivers/{sample_driver['id']}", json={"notes": "No"}
        )
        assert res.status_code == 403

    async def test_update_driver_requires_auth(
        self, client: AsyncClient, sample_driver: dict
    ):
        res = await client.patch(
            f"/api/v1/drivers/{sample_driver['id']}", json={"notes": "No"}
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteDriver:

    async def test_delete_driver(self, admin_client: AsyncClient):
        """Create a driver then delete — subsequent GET must 404."""
        payload = _driver_payload()
        created = await admin_client.post("/api/v1/drivers", json=payload)
        assert created.status_code == 201
        driver_id = created.json()["data"]["id"]

        res = await admin_client.delete(f"/api/v1/drivers/{driver_id}")
        assert res.status_code in (200, 204)

        get_res = await admin_client.get(f"/api/v1/drivers/{driver_id}")
        assert get_res.status_code == 404

    async def test_delete_nonexistent_driver(self, admin_client: AsyncClient):
        res = await admin_client.delete(f"/api/v1/drivers/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_driver_requires_admin(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        res = await auth_client.delete(f"/api/v1/drivers/{sample_driver['id']}")
        assert res.status_code == 403

    async def test_delete_driver_requires_auth(
        self, client: AsyncClient, sample_driver: dict
    ):
        res = await client.delete(f"/api/v1/drivers/{sample_driver['id']}")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# DRIVER DOCUMENTS
# ─────────────────────────────────────────────────────────────────────────────

class TestDriverDocuments:
    """
    POST /api/v1/drivers/{id}/documents  → DriverDocumentCreate
    GET  /api/v1/drivers/{id}/documents  → list[DriverDocumentResponse]

    DriverDocTypeEnum: license | medical | contract | certificate | other
    """

    async def test_upload_driver_document(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        driver_id = sample_driver["id"]
        payload = {
            "type": "license",
            "file_name": "driving_license.pdf",
            "file_url": "https://storage.example.com/docs/license.pdf",
            "expiry_date": "2027-12-31T00:00:00Z",
        }
        res = await admin_client.post(
            f"/api/v1/drivers/{driver_id}/documents", json=payload
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["type"] == "license"
        assert data["fileName"] == "driving_license.pdf"
        assert data["driverId"] == driver_id

    async def test_upload_all_document_types(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        driver_id = sample_driver["id"]
        for doc_type in ("medical", "contract", "certificate", "other"):
            res = await admin_client.post(
                f"/api/v1/drivers/{driver_id}/documents",
                json={
                    "type": doc_type,
                    "file_name": f"{doc_type}.pdf",
                    "file_url": f"https://storage.example.com/{doc_type}.pdf",
                },
            )
            assert res.status_code == 201, (
                f"Expected 201 for type={doc_type}: {res.text}"
            )

    async def test_list_driver_documents(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        driver_id = sample_driver["id"]
        # Upload one first
        await admin_client.post(
            f"/api/v1/drivers/{driver_id}/documents",
            json={
                "type": "medical",
                "file_name": "medical_cert.pdf",
                "file_url": "https://storage.example.com/medical.pdf",
            },
        )
        res = await admin_client.get(f"/api/v1/drivers/{driver_id}/documents")

        assert res.status_code == 200
        data = res.json()["data"]
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_upload_document_invalid_type(
        self, admin_client: AsyncClient, sample_driver: dict
    ):
        res = await admin_client.post(
            f"/api/v1/drivers/{sample_driver['id']}/documents",
            json={
                "type": "selfie",
                "file_name": "photo.jpg",
                "file_url": "https://storage.example.com/photo.jpg",
            },
        )
        assert res.status_code == 422

    async def test_upload_document_to_nonexistent_driver(
        self, admin_client: AsyncClient
    ):
        res = await admin_client.post(
            f"/api/v1/drivers/{NULL_UUID}/documents",
            json={
                "type": "license",
                "file_name": "ghost.pdf",
                "file_url": "https://storage.example.com/ghost.pdf",
            },
        )
        assert res.status_code == 404

    async def test_upload_document_requires_admin(
        self, auth_client: AsyncClient, sample_driver: dict
    ):
        res = await auth_client.post(
            f"/api/v1/drivers/{sample_driver['id']}/documents",
            json={
                "type": "license",
                "file_name": "test.pdf",
                "file_url": "https://storage.example.com/test.pdf",
            },
        )
        assert res.status_code == 403

    async def test_upload_document_requires_auth(
        self, client: AsyncClient, sample_driver: dict
    ):
        res = await client.post(
            f"/api/v1/drivers/{sample_driver['id']}/documents",
            json={
                "type": "license",
                "file_name": "test.pdf",
                "file_url": "https://storage.example.com/test.pdf",
            },
        )
        assert res.status_code == 401