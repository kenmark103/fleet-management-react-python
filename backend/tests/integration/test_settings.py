"""
tests/integration/test_settings.py
Fleet Management System — Phase 7

Integration tests for the System Settings API.
Covers read access and admin-gated updates.
"""

import pytest
from httpx import AsyncClient


class TestGetSettings:
    async def test_fetch_settings_as_admin(self, admin_client: AsyncClient):
        res = await admin_client.get("/api/v1/settings/system")

        assert res.status_code == 200
        data = res.json()["data"]
        # Confirm expected top-level keys are present
        assert "company_name" in data or "timezone" in data  # at least one setting key

    async def test_fetch_settings_as_regular_user(self, auth_client: AsyncClient):
        """Regular authenticated users should be able to read settings."""
        res = await auth_client.get("/api/v1/settings/system")
        assert res.status_code == 200

    async def test_fetch_settings_unauthenticated(self, client: AsyncClient):
        res = await client.get("/api/v1/settings/system")
        assert res.status_code == 401


class TestUpdateSettings:
    async def test_admin_can_update_settings(self, admin_client: AsyncClient):
        payload = {"company_name": "Fleet Corp Updated", "timezone": "America/Chicago"}
        res = await admin_client.patch("/api/v1/settings/system", json=payload)

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["company_name"] == "Fleet Corp Updated"
        assert data["timezone"] == "America/Chicago"

    async def test_update_persists(self, admin_client: AsyncClient):
        """Change a value, then re-fetch to confirm it was saved."""
        await admin_client.patch(
            "/api/v1/settings/system", json={"company_name": "Persistence Check"}
        )
        res = await admin_client.get("/api/v1/settings/system")
        assert res.json()["data"]["company_name"] == "Persistence Check"

    async def test_regular_user_cannot_update_settings(self, auth_client: AsyncClient):
        """Non-admin users must be forbidden from updating settings."""
        res = await auth_client.patch(
            "/api/v1/settings/system", json={"company_name": "Hijacked"}
        )
        assert res.status_code == 403

    async def test_unauthenticated_cannot_update_settings(self, client: AsyncClient):
        res = await client.patch(
            "/api/v1/settings/system", json={"company_name": "No token"}
        )
        assert res.status_code == 401

    async def test_update_with_invalid_timezone(self, admin_client: AsyncClient):
        res = await admin_client.patch(
            "/api/v1/settings/system", json={"timezone": "Mars/OlympusMons"}
        )
        assert res.status_code == 422

    async def test_partial_update_preserves_other_fields(
        self, admin_client: AsyncClient
    ):
        """PATCH should only change supplied fields, not wipe the rest."""
        # Set a known state
        await admin_client.patch(
            "/api/v1/settings/system",
            json={"company_name": "Original Co", "timezone": "UTC"},
        )
        # Partial update
        await admin_client.patch(
            "/api/v1/settings/system", json={"company_name": "New Co"}
        )
        res = await admin_client.get("/api/v1/settings/system")
        data = res.json()["data"]
        assert data["company_name"] == "New Co"
        assert data["timezone"] == "UTC"  # must be unchanged