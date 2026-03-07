"""
tests/conftest.py
Fleet Management System

Shared pytest fixtures for all integration tests.
Scope hierarchy:
  session → engine, schema creation, seed users
  function → db_session (rolled back), client, auth_client, admin_client, domain fixtures

Environment variables required (set in .env.test, never committed):
  TEST_DATABASE_URL  — e.g. postgresql+asyncpg://user:pass@localhost:5432/fleet_test
"""

import pytest
import pytest_asyncio

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)

from main import app
from db.dbconfig import async_session
from core.config import get_settings

# ─────────────────────────────────────────────────────────────────────────────
# ENGINE & SCHEMA  (session-scoped — created once per test run)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session")
async def engine() -> AsyncEngine:
    """
    Create the async engine pointed at the test DB, build all tables,
    yield for the whole session, then drop everything and dispose.
    NullPool is intentional: prevents connections leaking between tests.
    """
    from sqlalchemy.pool import NullPool
    from db import models  # ensures all ORM models are registered on Base.metadata

    settings = get_settings()
    _engine = create_async_engine(
        settings.TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
        future=True,
    )

    async with _engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

    yield _engine

    async with _engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.drop_all)

    await _engine.dispose()


# ─────────────────────────────────────────────────────────────────────────────
# SEED USERS  (session-scoped autouse — runs once after schema is ready)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def seed_users(engine: AsyncEngine):
    """
    Insert the two well-known test users that auth_client / admin_client depend on.
    Runs once per session after tables exist.  Uses INSERT … ON CONFLICT DO NOTHING
    so re-runs against a persistent test DB are safe.

    Credentials (also document these in .env.test.example):
        mechanic@fleetapp.com  / Test1234!   role=MECHANIC
        admin@fleetapp.com     / Admin1234!  role=ADMIN
    """
    from db.models import User
    from auth.security import hash_password

    SessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with SessionFactory() as session:
        existing_emails = {"mechanic@fleetapp.com", "admin@fleetapp.com"}

        # Check which users already exist so we stay idempotent
        from sqlalchemy import select
        result = await session.execute(
            select(User.email).where(User.email.in_(existing_emails))
        )
        already_seeded = {row[0] for row in result.fetchall()}

        users_to_add = []

        if "mechanic@fleetapp.com" not in already_seeded:
            users_to_add.append(
                User(
                    first_name="Test",
                    last_name="Mechanic",
                    email="mechanic@fleetapp.com",
                    password=hash_password("Test1234!"),
                    role="MECHANIC",
                    is_active=True,
                    is_verified=True,
                )
            )

        if "admin@fleetapp.com" not in already_seeded:
            users_to_add.append(
                User(
                    first_name="Test",
                    last_name="Admin",
                    email="admin@fleetapp.com",
                    password=hash_password("Admin1234!"),
                    role="ADMIN",
                    is_active=True,
                    is_verified=True,
                )
            )

        if users_to_add:
            session.add_all(users_to_add)
            await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# DB SESSION  (function-scoped — rolls back after every test)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncSession:
    """
    Fresh session per test.  Always rolls back — tests never permanently
    mutate the DB, so order-independence is guaranteed.
    """
    SessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with SessionFactory() as session:
        yield session
        await session.rollback()


# ─────────────────────────────────────────────────────────────────────────────
# HTTP CLIENTS
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    """
    Unauthenticated HTTPX client.
    Use this to verify that protected endpoints correctly return 401.
    """
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[async_session] = _override_get_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


def _extract_access_token(body: dict) -> str:
    """
    Handle both response shapes:
      flat:     {"access_token": "...", "refresh_token": "..."}   ← current auth routes
      enveloped: {"data": {"access_token": "...", ...}}           ← Phase 7 style
    """
    if "data" in body:
        return body["data"]["access_token"]
    return body["access_token"]


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as a regular (mechanic) user.
    Logs in via the real /auth/token endpoint so the JWT stack is exercised.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": "mechanic@fleetapp.com",
            "password": "Test1234!",
        },
    )
    assert res.status_code == 200, (
        f"auth_client login failed ({res.status_code}): {res.text}\n"
        "Hint: make sure seed_users ran and TEST_DATABASE_URL points at the right DB."
    )
    token = _extract_access_token(res.json())
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest_asyncio.fixture
async def admin_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as an admin user.
    Logs in via the real /auth/token endpoint.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": "admin@fleetapp.com",
            "password": "Admin1234!",
        },
    )
    assert res.status_code == 200, (
        f"admin_client login failed ({res.status_code}): {res.text}\n"
        "Hint: make sure seed_users ran and TEST_DATABASE_URL points at the right DB."
    )
    token = _extract_access_token(res.json())
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


# ─────────────────────────────────────────────────────────────────────────────
# DOMAIN FIXTURES  (depend on auth_client so they use an authenticated session)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_vehicle_id(auth_client: AsyncClient) -> str:
    """Create a vehicle and return its ID for use in maintenance tests."""
    res = await auth_client.post(
        "/api/v1/fleet/vehicles",
        json={
            "make": "Ford",
            "model": "Transit",
            "year": 2022,
            "vin": "1FTBW2CM0NKA00001",
            "license_plate": "TST-001",
        },
    )
    assert res.status_code == 201, f"Vehicle fixture failed: {res.text}"
    return res.json()["data"]["id"]


@pytest_asyncio.fixture
async def work_order(auth_client: AsyncClient, sample_vehicle_id: str) -> dict:
    """A single open work order."""
    res = await auth_client.post(
        "/api/v1/maintenance/work-orders",
        json={
            "vehicle_id": sample_vehicle_id,
            "title": "Fixture: brake inspection",
            "priority": "medium",
            "scheduled_date": "2025-07-01",
        },
    )
    assert res.status_code == 201, f"Work order fixture failed: {res.text}"
    return res.json()["data"]


@pytest_asyncio.fixture
async def multiple_work_orders(
    auth_client: AsyncClient, sample_vehicle_id: str
) -> list[dict]:
    """Three work orders for pagination and filter tests."""
    orders = []
    for i in range(3):
        res = await auth_client.post(
            "/api/v1/maintenance/work-orders",
            json={
                "vehicle_id": sample_vehicle_id,
                "title": f"Fixture WO #{i + 1}",
                "priority": "low",
            },
        )
        assert res.status_code == 201
        orders.append(res.json()["data"])
    return orders


@pytest_asyncio.fixture
async def completed_work_order(
    auth_client: AsyncClient, work_order: dict
) -> dict:
    """A work order progressed through to completed status."""
    wo_id = work_order["id"]
    await auth_client.patch(
        f"/api/v1/maintenance/work-orders/{wo_id}/status",
        json={"status": "in_progress"},
    )
    res = await auth_client.patch(
        f"/api/v1/maintenance/work-orders/{wo_id}/status",
        json={"status": "completed"},
    )
    assert res.status_code == 200, f"completed_work_order fixture failed: {res.text}"
    return res.json()["data"]


@pytest_asyncio.fixture
async def work_order_with_part(
    auth_client: AsyncClient, work_order: dict
) -> dict:
    """A work order that already has one part attached."""
    wo_id = work_order["id"]
    res = await auth_client.post(
        f"/api/v1/maintenance/work-orders/{wo_id}/parts",
        json={
            "part_number": "FXT-PART-001",
            "name": "Fixture Part",
            "quantity": 2,
            "unit_cost": 15.00,
        },
    )
    assert res.status_code == 201, f"work_order_with_part fixture failed: {res.text}"
    res = await auth_client.get(f"/api/v1/maintenance/work-orders/{wo_id}")
    return res.json()["data"]


@pytest_asyncio.fixture
async def service_schedule(
    auth_client: AsyncClient, sample_vehicle_id: str
) -> dict:
    """A basic oil-change service schedule."""
    res = await auth_client.post(
        "/api/v1/maintenance/schedules",
        json={
            "vehicle_id": sample_vehicle_id,
            "service_type": "oil_change",
            "interval_miles": 5000,
            "interval_days": 90,
            "last_service_date": "2025-01-01",
            "last_service_mileage": 40000,
        },
    )
    assert res.status_code == 201, f"service_schedule fixture failed: {res.text}"
    return res.json()["data"]


@pytest_asyncio.fixture
async def overdue_schedule(
    auth_client: AsyncClient, sample_vehicle_id: str
) -> dict:
    """A schedule whose next service date is in the past (overdue)."""
    res = await auth_client.post(
        "/api/v1/maintenance/schedules",
        json={
            "vehicle_id": sample_vehicle_id,
            "service_type": "tire_rotation",
            "interval_miles": 7500,
            "interval_days": 30,
            "last_service_date": "2024-01-01",   # far in the past → always overdue
            "last_service_mileage": 10000,
        },
    )
    assert res.status_code == 201, f"overdue_schedule fixture failed: {res.text}"
    return res.json()["data"]