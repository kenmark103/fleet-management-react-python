# tests/ui/test_auth.py
# remember to disable background tasks when u write registration tests#
import pytest

@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

@pytest.mark.asyncio
async def test_login_success(client, test_user):
    payload = {
        "username": "test_user",
        "email": "test_user@example.com",
        "password": "test_pass",
    }
    response = await client.post("/auth/token", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_wrong_password(client):
    payload = {
        "username": "test_user",
        "email": "test_user@example.com",
        "password": "wrong_pass",
    }
    response = await client.post("/auth/token", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

@pytest.mark.asyncio
async def test_login_nonexistent_email(client):
    payload = {
        "username": "test_user",
        "email": "blablabla@example.com",
        "password": "testpass",
    }
    response = await client.post("/auth/token", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"