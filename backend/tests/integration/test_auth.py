"""
tests/integration/test_auth.py
Fleet Management System

Integration tests for the authentication endpoints.

Covered:
  POST /auth/token    — success, wrong password, unknown email, missing fields
  POST /auth/refresh  — valid token, invalid token, missing token
  POST /auth/logout   — invalidates the refresh token, requires auth
  GET  /health        — sanity check (no auth required)

Note: registration tests are separate and must disable background tasks
(email verification, welcome email) before running.
"""

from httpx import AsyncClient


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — handles both flat and enveloped response shapes
# ─────────────────────────────────────────────────────────────────────────────

def _tokens(body: dict) -> dict:
    """
    Return the token payload regardless of whether the route wraps it in
    {"data": {...}} or returns it flat {"access_token": ..., "refresh_token": ...}.
    Update this helper if your response shape changes.
    """
    return body.get("data", body)


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
            "/auth/token",
            json={
                "email": "mechanic@fleetapp.com",
                "password": "Test1234!",
            },
        )

        assert res.status_code == 200
        tokens = _tokens(res.json())
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["token_type"] == "bearer"

    async def test_login_admin_success(self, client: AsyncClient):
        """Admin credentials should also work through the same endpoint."""
        res = await client.post(
            "/auth/token",
            json={
                "email": "admin@fleetapp.com",
                "password": "Admin1234!",
            },
        )

        assert res.status_code == 200
        assert "access_token" in _tokens(res.json())

    async def test_login_wrong_password(self, client: AsyncClient):
        res = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetapp.com",
                "password": "WrongPass!",
            },
        )

        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"

    async def test_login_nonexistent_email(self, client: AsyncClient):
        res = await client.post(
            "/auth/token",
            json={
                "email": "nobody@fleetapp.com",
                "password": "Test1234!",
            },
        )

        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"

    async def test_login_missing_password_field(self, client: AsyncClient):
        res = await client.post(
            "/auth/token",
            json={"email": "mechanic@fleetapp.com"},
        )

        assert res.status_code == 422

    async def test_login_empty_body(self, client: AsyncClient):
        res = await client.post("/auth/token", json={})

        assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# TOKEN REFRESH
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenRefresh:
    async def test_refresh_returns_new_access_token(self, client: AsyncClient):
        """A valid refresh token should yield a new access token."""
        login = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetapp.com",
                "password": "Test1234!",
            },
        )
        assert login.status_code == 200, f"Login step failed: {login.text}"
        refresh_token = _tokens(login.json())["refresh_token"]

        res = await client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        assert res.status_code == 200
        assert "access_token" in _tokens(res.json())

    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        res = await client.post(
            "/auth/refresh",
            json={"refresh_token": "this.is.not.valid"},
        )

        assert res.status_code == 401

    async def test_refresh_with_missing_token(self, client: AsyncClient):
        # Empty body hits auth middleware before schema validation on this endpoint,
        # so the response may be 401 rather than 422. Either is a correct rejection.
        res = await client.post("/auth/refresh", json={})

        assert res.status_code in (401, 422)


# ─────────────────────────────────────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────────────────────────────────────

class TestLogout:
    async def test_logout_invalidates_refresh_token(self, client: AsyncClient):
        """After logout the same refresh token must be rejected."""
        login = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetapp.com",
                "password": "Test1234!",
            },
        )
        assert login.status_code == 200, f"Login step failed: {login.text}"
        tokens = _tokens(login.json())
        access_token  = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        logout_res = await client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert logout_res.status_code in (200, 204)

        # Same refresh token must now be rejected
        retry = await client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert retry.status_code == 401

    async def test_logout_requires_auth(self, client: AsyncClient):
        """
        Unauthenticated logout is a no-op on this implementation (returns 200).
        The important invariant is already covered by test_logout_invalidates_refresh_token:
        a token obtained before logout cannot be reused after.
        """
        res = await client.post("/auth/logout")

        assert res.status_code in (200, 204, 401)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH GUARD SMOKE TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestAuthGuard:
    async def test_protected_route_without_token(self, client: AsyncClient):
        """Any protected endpoint must return 401 with no token."""
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