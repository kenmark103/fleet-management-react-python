"""
tests/integration/test_settings.py
Fleet Management System

RBAC summary for /api/v1/settings/system:
  GET    → any authenticated user (admin, mechanic, dispatcher, finance, driver)
  PATCH  → ADMIN only → 403 for all other roles

Response fields are camelCase due to CamelBase serialization:
  org_name     (request) → orgName     (response)
  org_timezone (request) → orgTimezone (response)
"""

import pytest
from httpx import AsyncClient


class TestGetSettings:
    async def test_fetch_settings_as_admin(self, admin_client: AsyncClient):
        res = await admin_client.get("/api/v1/settings/system")

        assert res.status_code == 200
        data = res.json()["data"]
        assert "orgName" in data
        assert "orgTimezone" in data

    async def test_fetch_settings_as_regular_user(self, auth_client: AsyncClient):
        """Any authenticated user can read settings regardless of role."""
        res = await auth_client.get("/api/v1/settings/system")
        assert res.status_code == 200

    async def test_fetch_settings_unauthenticated(self, client: AsyncClient):
        res = await client.get("/api/v1/settings/system")
        assert res.status_code == 401


class TestUpdateSettings:
    async def test_admin_can_update_settings(self, admin_client: AsyncClient):
        payload = {
            "org_name": "Fleet Corp Updated",
            "org_timezone": "America/Chicago",
        }
        res = await admin_client.patch("/api/v1/settings/system", json=payload)

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["orgName"] == "Fleet Corp Updated"
        assert data["orgTimezone"] == "America/Chicago"

    async def test_update_persists(self, admin_client: AsyncClient):
        """Change a value then re-fetch to confirm it was saved."""
        await admin_client.patch(
            "/api/v1/settings/system", json={"org_name": "Persistence Check"}
        )
        res = await admin_client.get("/api/v1/settings/system")
        assert res.json()["data"]["orgName"] == "Persistence Check"

    async def test_mechanic_cannot_update_settings(self, mechanic_client: AsyncClient):
        """
        Non-admin roles must receive 403 when attempting to update settings.
        Uses mechanic_client (MECHANIC role) as the representative non-admin.
        """
        res = await mechanic_client.patch(
            "/api/v1/settings/system", json={"org_name": "Hijacked"}
        )
        assert res.status_code == 403

    async def test_dispatcher_cannot_update_settings(
        self, dispatcher_client: AsyncClient
    ):
        res = await dispatcher_client.patch(
            "/api/v1/settings/system", json={"org_name": "Hijacked"}
        )
        assert res.status_code == 403

    async def test_finance_cannot_update_settings(self, finance_client: AsyncClient):
        res = await finance_client.patch(
            "/api/v1/settings/system", json={"org_name": "Hijacked"}
        )
        assert res.status_code == 403

    async def test_unauthenticated_cannot_update_settings(
        self, client: AsyncClient
    ):
        res = await client.patch(
            "/api/v1/settings/system", json={"org_name": "No token"}
        )
        assert res.status_code == 401

    async def test_update_with_invalid_timezone(self, admin_client: AsyncClient):
        res = await admin_client.patch(
            "/api/v1/settings/system", json={"org_timezone": "Mars/OlympusMons"}
        )
        assert res.status_code == 422

    async def test_partial_update_preserves_other_fields(
        self, admin_client: AsyncClient
    ):
        """PATCH only changes supplied fields — others must be preserved."""
        await admin_client.patch(
            "/api/v1/settings/system",
            json={"org_name": "Original Co", "org_timezone": "UTC"},
        )
        await admin_client.patch(
            "/api/v1/settings/system", json={"org_name": "New Co"}
        )
        res = await admin_client.get("/api/v1/settings/system")
        data = res.json()["data"]
        assert data["orgName"] == "New Co"
        assert data["orgTimezone"] == "UTC"