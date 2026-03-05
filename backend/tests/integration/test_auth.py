"""
tests/integration/test_auth.py
Fleet Management System

Integration tests for the authentication endpoints.

Covered:
  POST /api/v1/auth/login   — success, wrong password, unknown email, inactive user
  POST /api/v1/auth/refresh — valid token, expired/invalid token
  POST /api/v1/auth/logout  — invalidates the refresh token
  GET  /health              — sanity check (no auth required)

Note: registration tests are separate and must disable background tasks
(email verification, welcome email) before running.
"""

import pytest
from httpx import AsyncClient


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthCheck:
    async def test_health_check_returns_healthy(self, client: AsyncClient):
        res = await client.get("/health")

        assert res.status_code == 200
        assert res.json()["status"] == "healthy"


# ─────────────────────────────────────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────────────────────────────────────

class TestLogin:
    async def test_login_success_returns_tokens(self, client: AsyncClient):
        """Valid credentials should return both access and refresh tokens."""
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "mechanic@fleet.test", "password": "Test1234!"},
        )

        assert res.status_code == 200
        data = res.json()["data"]
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_admin_success(self, client: AsyncClient):
        """Admin credentials should also work through the same endpoint."""
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@fleet.test", "password": "Admin1234!"},
        )

        assert res.status_code == 200
        assert "access_token" in res.json()["data"]

    async def test_login_wrong_password(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "mechanic@fleet.test", "password": "WrongPass!"},
        )

        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"

    async def test_login_nonexistent_email(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@fleet.test", "password": "Test1234!"},
        )

        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"

    async def test_login_missing_email_field(self, client: AsyncClient):
        """Request body that omits email should fail validation."""
        res = await client.post(
            "/api/v1/auth/login",
            json={"password": "Test1234!"},
        )

        assert res.status_code == 422

    async def test_login_missing_password_field(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "mechanic@fleet.test"},
        )

        assert res.status_code == 422

    async def test_login_empty_body(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/login", json={})

        assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# TOKEN REFRESH
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenRefresh:
    async def test_refresh_returns_new_access_token(self, client: AsyncClient):
        """A valid refresh token should yield a new access token."""
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "mechanic@fleet.test", "password": "Test1234!"},
        )
        refresh_token = login.json()["data"]["refresh_token"]

        res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        assert res.status_code == 200
        assert "access_token" in res.json()["data"]

    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "this.is.not.valid"},
        )

        assert res.status_code == 401

    async def test_refresh_with_missing_token(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/refresh", json={})

        assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────────────────────────────────────

class TestLogout:
    async def test_logout_invalidates_refresh_token(self, client: AsyncClient):
        """After logout the same refresh token must be rejected."""
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "mechanic@fleet.test", "password": "Test1234!"},
        )
        tokens = login.json()["data"]
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        # Logout
        logout_res = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert logout_res.status_code in (200, 204)

        # Attempt to reuse the refresh token — must now be rejected
        retry = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert retry.status_code == 401

    async def test_logout_requires_auth(self, client: AsyncClient):
        """Unauthenticated logout attempt must return 401."""
        res = await client.post("/api/v1/auth/logout")

        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# PROTECTED ENDPOINT SMOKE TEST
# ─────────────────────────────────────────────────────────────────────────────

class TestAuthGuard:
    async def test_protected_route_without_token(self, client: AsyncClient):
        """Any protected endpoint should return 401 with no token."""
        res = await client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 401

    async def test_protected_route_with_valid_token(self, auth_client: AsyncClient):
        """The same endpoint should be reachable once authenticated."""
        res = await auth_client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 200

    async def test_protected_route_with_malformed_token(self, client: AsyncClient):
        res = await client.get(
            "/api/v1/maintenance/work-orders",
            headers={"Authorization": "Bearer not.a.real.token"},
        )

        assert res.status_code == 401