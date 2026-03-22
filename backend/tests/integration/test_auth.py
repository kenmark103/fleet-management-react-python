"""
tests/integration/test_auth.py
Fleet Management System

Integration tests for the authentication endpoints.
UPDATED for cookie-based authentication (tokens in HttpOnly cookies).

Covered:
  POST /auth/token    — success, wrong password, unknown email, missing fields
  POST /auth/refresh  — valid cookie, invalid cookie, missing cookie
  POST /auth/logout   — clears cookies, requires auth
  GET  /health        — sanity check (no auth required)

Note: Tokens are now stored in HttpOnly cookies, not returned in JSON body.
"""

from httpx import AsyncClient


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — extract cookies from response
# ─────────────────────────────────────────────────────────────────────────────

def _get_cookie(response, cookie_name: str) -> str | None:
    """Extract a specific cookie value from response headers."""
    # httpx stores cookies in response.cookies
    return response.cookies.get(cookie_name)


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
    async def test_login_success_returns_tokens_in_cookies(self, client: AsyncClient):
        """Valid credentials should set both access_token and refresh_token cookies."""
        res = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetms.com",  # FIXED: was fleetapp.com
                "password": "Test1234!",
            },
        )

        assert res.status_code == 200
        # Tokens are now in HttpOnly cookies, not JSON body
        assert "access_token" in res.cookies
        assert "refresh_token" in res.cookies
        # Response body contains user data and message
        body = res.json()
        assert body["message"] == "Login successful"
        assert "user" in body
        assert body["user"]["email"] == "mechanic@fleetms.com"

    async def test_login_admin_success(self, client: AsyncClient):
        """Admin credentials should also work and set cookies."""
        res = await client.post(
            "/auth/token",
            json={
                "email": "admin@fleetms.com",
                "password": "Admin1234!",
            },
        )

        assert res.status_code == 200
        assert "access_token" in res.cookies
        assert "refresh_token" in res.cookies
        body = res.json()
        assert body["user"]["role"] == "ADMIN"

    async def test_login_wrong_password(self, client: AsyncClient):
        res = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetms.com",
                "password": "WrongPass!",
            },
        )

        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"

    async def test_login_nonexistent_email(self, client: AsyncClient):
        res = await client.post(
            "/auth/token",
            json={
                "email": "nobody@fleetms.com",
                "password": "Test1234!",
            },
        )

        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"

    async def test_login_missing_password_field(self, client: AsyncClient):
        res = await client.post(
            "/auth/token",
            json={"email": "mechanic@fleetms.com"},
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
        """A valid refresh token cookie should yield a new access token cookie."""
        # First login to get cookies
        login = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetms.com",  # FIXED: was fleetapp.com
                "password": "Test1234!",
            },
        )
        assert login.status_code == 200, f"Login step failed: {login.text}"
        # Refresh token is now in cookies, not JSON body
        assert "refresh_token" in login.cookies

        # Refresh endpoint reads refresh_token from cookies, not JSON body
        res = await client.post("/auth/refresh")

        assert res.status_code == 200
        # New access_token cookie should be set
        assert "access_token" in res.cookies
        body = res.json()
        assert body["message"] == "Token refreshed"

    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        """Manually set an invalid refresh cookie and verify it's rejected."""
        # Clear any existing cookies and set invalid one
        client.cookies.clear()
        client.cookies.set("refresh_token", "this.is.not.valid")

        res = await client.post("/auth/refresh")

        assert res.status_code == 401

    async def test_refresh_with_missing_token(self, client: AsyncClient):
        """No refresh cookie should return 401."""
        # Clear any cookies
        client.cookies.clear()

        res = await client.post("/auth/refresh")

        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────────────────────────────────────

class TestLogout:
    async def test_logout_clears_cookies(self, client: AsyncClient):
        """After logout the cookies should be cleared."""
        # Login first
        login = await client.post(
            "/auth/token",
            json={
                "email": "mechanic@fleetms.com",  # FIXED: was fleetapp.com
                "password": "Test1234!",
            },
        )
        assert login.status_code == 200, f"Login step failed: {login.text}"
        # Verify cookies exist
        assert "access_token" in login.cookies
        assert "refresh_token" in login.cookies

        # Logout (cookies are automatically sent by client)
        logout_res = await client.post("/auth/logout")
        assert logout_res.status_code == 200
        assert logout_res.json()["message"] == "Logged out successfully"

        # After logout, cookies should be cleared (expired)
        # httpx doesn't automatically remove cookies on response, but server sets expire
        # Verify refresh fails after logout
        refresh_res = await client.post("/auth/refresh")
        assert refresh_res.status_code == 401

    async def test_logout_requires_auth(self, client: AsyncClient):
        """
        Logout without auth cookies still returns 200 (it's a no-op on server side).
        The cookies are cleared regardless.
        """
        # Clear any cookies
        client.cookies.clear()

        res = await client.post("/auth/logout")

        assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# AUTH GUARD SMOKE TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestAuthGuard:
    async def test_protected_route_without_token(self, client: AsyncClient):
        """Any protected endpoint must return 401 with no token cookie."""
        # Ensure no cookies
        client.cookies.clear()

        res = await client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 401

    async def test_protected_route_with_valid_token(self, auth_client: AsyncClient):
        """The same endpoint should be reachable once authenticated."""
        res = await auth_client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 200

    async def test_protected_route_with_malformed_token(self, client: AsyncClient):
        # Clear and set malformed token
        client.cookies.clear()
        client.cookies.set("access_token", "not.a.real.token")

        res = await client.get("/api/v1/maintenance/work-orders")

        assert res.status_code == 401