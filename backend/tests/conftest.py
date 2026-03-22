"""
tests/conftest.py
Fleet Management System

Shared pytest fixtures for all integration tests.

Scope hierarchy:
  session  → engine, schema creation, seed users (runs once per test run)
  function → db_session (rolled back), HTTP clients, domain fixtures

────────────────────────────────────────────────────────────────
KEY ARCHITECTURAL NOTE — Cookie-based auth (why no _access_token helper)
────────────────────────────────────────────────────────────────
The auth system stores tokens in HttpOnly cookies, NOT in the JSON body.
Login response body is: {"message": "Login successful", "user": {...}}

httpx's AsyncClient automatically:
  1. Stores Set-Cookie headers from login responses in its cookie jar
  2. Replays those cookies on every subsequent request

So auth client fixtures ONLY need to fire the login POST.
No token extraction, no header manipulation — httpx handles it.

────────────────────────────────────────────────────────────────
CLIENT HIERARCHY
────────────────────────────────────────────────────────────────
  client              ← unauthenticated  (use for 401 assertions)
      ├── auth_client         ← MECHANIC role  (default for most tests)
      ├── mechanic_client     ← alias for auth_client (explicit name)
      ├── admin_client        ← ADMIN role      (settings, user management)
      ├── dispatcher_client   ← DISPATCHER role (trip creation)
      ├── finance_client      ← FINANCE role    (expenses, reports)
      └── driver_client       ← DRIVER role     (trip view, own fuel logs)

────────────────────────────────────────────────────────────────
WHAT WAS WRONG IN THE PREVIOUS conftest.py
────────────────────────────────────────────────────────────────
1. _access_token() tried to read access_token from JSON body.
   POST /auth/token now returns {"message": ..., "user": ...}.
   access_token is in Set-Cookie, not body. KeyError on every login.

2. client.headers.update({"Authorization": f"Bearer {token}"})
   App reads auth from cookies, not Authorization header.
   Even if token extraction worked, headers would be ignored by
   the security middleware. All auth fixture clients were broken.

3. test_settings.py did: from tests.conftest import mechanic_client
   Pytest fixtures cannot be imported — they must be injected.
   Also references a name that didn't exist (was auth_client).
   Fixed by adding mechanic_client alias here and removing the import.

4. sample_vehicle_id → renamed to sample_truck_id (Truck not Vehicle)
5. Work order status "open" → "pending", "in_progress" → "in-progress"
6. ServiceSchedule fields: interval_miles/days → interval_type + interval_value
7. WorkOrderPart field: name → part_name; total_cost non-nullable
8. Driver requires user_id FK → added driver_user_seed + sample_driver
9. Five roles: added DISPATCHER and FINANCE seed users
10. SystemSettings: company_name/timezone → org_name/org_timezone

Environment variables required (.env.test, never committed):
  TEST_DATABASE_URL  — e.g. postgresql+asyncpg://user:pass@localhost:5432/fleet_test
  SECRET_KEY         — any 32-char string for the test environment
"""

import asyncio
import sys
import uuid

import pytest
import pytest_asyncio

from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)

# ── Windows + Python 3.13 event loop ─────────────────────────────────────────
# asyncpg does not support ProactorEventLoop (Windows default in Python 3.8+).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from main import app
from db.dbconfig import get_async_session
from core.config import get_settings


# ─────────────────────────────────────────────────────────────────────────────
# SESSION-SCOPED EVENT LOOP
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """
    Single event loop for the entire test session.

    Required because SQLAlchemy's asyncpg engine binds connection pools
    to the creating event loop. pytest-asyncio v0.24+ defaults to
    function-scoped loops which causes 'attached to a different loop'
    errors when a session-scoped engine tries to reuse connections.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ─────────────────────────────────────────────────────────────────────────────
# RATE LIMITER RESET (autouse — resets before every test)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def disable_rate_limit():
    """
    Reset slowapi's in-memory counter before every test.
    /auth/token is rate-limited to 5/minute. The test suite calls login
    many times in quick succession and would hit 429 without this reset.
    """
    limiter = getattr(app.state, "limiter", None)
    if limiter is not None:
        storage = getattr(limiter, "_storage", None)
        if storage is not None and hasattr(storage, "reset"):
            storage.reset()
    yield


# ─────────────────────────────────────────────────────────────────────────────
# SEED CREDENTIALS
# Keep in sync with: frontend/web/tests/e2e/fixtures.ts (Playwright)
# ─────────────────────────────────────────────────────────────────────────────

SEED = {
    "admin": {
        "email": "admin@fleetms.com",
        "password": "Admin1234!",
        "role": "ADMIN",
        "first_name": "Test",
        "last_name": "Admin",
    },
    "mechanic": {
        "email": "mechanic@fleetms.com",
        "password": "Test1234!",
        "role": "MECHANIC",
        "first_name": "Test",
        "last_name": "Mechanic",
    },
    "dispatcher": {
        "email": "dispatcher@fleetms.com",
        "password": "Dispatch1234!",
        "role": "DISPATCHER",
        "first_name": "Test",
        "last_name": "Dispatcher",
    },
    "finance": {
        "email": "finance@fleetms.com",
        "password": "Finance1234!",
        "role": "FINANCE",
        "first_name": "Test",
        "last_name": "Finance",
    },
    "driver_user": {
        # Backing User row for Driver profile fixtures.
        # Driver.user_id is a unique FK → users.id.
        # This account is the DB parent; sample_driver creates the Driver profile.
        "email": "driver.fixture@fleetms.com",
        "password": "Driver1234!",
        "role": "DRIVER",
        "first_name": "Fixture",
        "last_name": "Driver",
    },
    "driver_e2e": {
        # Playwright fixtures.ts logs in as kuriaj@fleetms.com.
        # Seeded here so E2E tests share the same backend accounts.
        "email": "kuriaj@fleetms.com",
        "password": "12345678",
        "role": "DRIVER",
        "first_name": "Kuria",
        "last_name": "J",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE & SCHEMA  (session-scoped — created once per test run)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session")
async def engine() -> AsyncEngine:
    """
    Async engine pointed at the test DB.

    Always DROP then CREATE all tables to guarantee the schema matches
    the current models even if the test DB already existed from a prior
    run (create_all() alone would silently miss new columns).

    NullPool prevents connections leaking between tests.
    """
    from sqlalchemy.pool import NullPool
    from db import models  # registers all ORM models on Base.metadata

    settings = get_settings()
    _engine = create_async_engine(
        settings.TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
        future=True,
    )

    async with _engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.drop_all)
        await conn.run_sync(models.Base.metadata.create_all)

    yield _engine

    await _engine.dispose()
    async with _engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.drop_all)


# ─────────────────────────────────────────────────────────────────────────────
# SEED USERS  (session-scoped autouse)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def seed_users(engine: AsyncEngine) -> None:
    """
    Insert all test accounts once per session after tables exist.
    Idempotent: checks existing rows first to avoid duplicate-key errors
    on re-runs against a persistent test DB.
    """
    from db.models import User
    from auth.security import hash_password

    SessionFactory = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )

    all_emails = {v["email"] for v in SEED.values()}

    async with SessionFactory() as session:
        result = await session.execute(
            select(User.email).where(User.email.in_(all_emails))
        )
        already_seeded = {row[0] for row in result.fetchall()}

        to_add = []
        for key, creds in SEED.items():
            if creds["email"] not in already_seeded:
                to_add.append(
                    User(
                        first_name=creds["first_name"],
                        last_name=creds["last_name"],
                        email=creds["email"],
                        password=hash_password(creds["password"]),
                        role=creds["role"],
                        is_active=True,
                        is_verified=True,
                    )
                )

        if to_add:
            session.add_all(to_add)
            await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# DB SESSION  (function-scoped — rolls back after every test)
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncSession:
    """
    Fresh session per test. Always rolls back so tests never permanently
    mutate the DB and test ordering never matters.
    """
    SessionFactory = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with SessionFactory() as session:
        yield session
        await session.rollback()


# ─────────────────────────────────────────────────────────────────────────────
# HTTP CLIENTS
# ─────────────────────────────────────────────────────────────────────────────
#
# HOW COOKIE AUTH WORKS IN HTTPX:
#   When POST /auth/token succeeds, the server sets:
#     Set-Cookie: access_token=<jwt>; HttpOnly; ...
#     Set-Cookie: refresh_token=<jwt>; HttpOnly; ...
#   httpx's AsyncClient automatically stores these in its cookie jar
#   and sends them on every subsequent request. No manual extraction
#   or header setting required.
#
# PATTERN for all auth fixtures:
#   1. Receive the shared `client` (unauthenticated, session wired up)
#   2. POST to /auth/token — cookies are stored automatically
#   3. Return the same client — it is now authenticated
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    """
    Unauthenticated HTTPX client wired to the test DB via ASGI transport.
    Use to verify endpoints return 401 when no auth cookie is present.

    Overrides get_async_session so route handlers query the test DB,
    not the production DB from dbconfig.py.
    """
    async def _override_get_session():
        yield db_session

    app.dependency_overrides[get_async_session] = _override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True,
    ) as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as MECHANIC (mechanic@fleetms.com).
    Default client for most maintenance and general endpoint tests.

    Cookies are set automatically by httpx on login — no token
    extraction or header injection needed.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": SEED["mechanic"]["email"],
            "password": SEED["mechanic"]["password"],
        },
    )
    assert res.status_code == 200, (
        f"auth_client login failed ({res.status_code}): {res.text}\n"
        "Hint: check seed_users ran and TEST_DATABASE_URL is correct."
    )
    # Cookies (access_token, refresh_token) are now in client.cookies.
    # httpx will send them automatically on every subsequent request.
    return client


@pytest_asyncio.fixture
async def mechanic_client(auth_client: AsyncClient) -> AsyncClient:
    """
    Explicit alias for auth_client with a role-descriptive name.
    Use in tests where you want to be explicit about the MECHANIC role,
    e.g. RBAC tests that need to show a mechanic cannot update settings.
    """
    return auth_client


@pytest_asyncio.fixture
async def admin_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as ADMIN (admin@fleetms.com).
    Use for settings, user-management, and admin-only route tests.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": SEED["admin"]["email"],
            "password": SEED["admin"]["password"],
        },
    )
    assert res.status_code == 200, (
        f"admin_client login failed ({res.status_code}): {res.text}"
    )
    return client


@pytest_asyncio.fixture
async def dispatcher_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as DISPATCHER (dispatcher@fleetms.com).
    Use for trip creation, dispatch, and driver assignment tests.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": SEED["dispatcher"]["email"],
            "password": SEED["dispatcher"]["password"],
        },
    )
    assert res.status_code == 200, (
        f"dispatcher_client login failed ({res.status_code}): {res.text}"
    )
    return client


@pytest_asyncio.fixture
async def finance_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as FINANCE (finance@fleetms.com).
    Use for expense submission, fuel report, and financial summary tests.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": SEED["finance"]["email"],
            "password": SEED["finance"]["password"],
        },
    )
    assert res.status_code == 200, (
        f"finance_client login failed ({res.status_code}): {res.text}"
    )
    return client


@pytest_asyncio.fixture
async def driver_client(client: AsyncClient) -> AsyncClient:
    """
    Client authenticated as DRIVER (kuriaj@fleetms.com / E2E account).
    Use for driver-perspective tests: viewing own trips, logging fuel,
    and RBAC checks that drivers cannot access admin/mechanic routes.
    """
    res = await client.post(
        "/auth/token",
        json={
            "email": SEED["driver_e2e"]["email"],
            "password": SEED["driver_e2e"]["password"],
        },
    )
    assert res.status_code == 200, (
        f"driver_client login failed ({res.status_code}): {res.text}"
    )
    return client


# ─────────────────────────────────────────────────────────────────────────────
# USER ID HELPERS
# Look up seeded user PKs so fixtures can supply non-nullable FK columns.
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def mechanic_user_id(db_session: AsyncSession) -> str:
    """
    DB id of mechanic@fleetms.com.
    Required by work_order (assigned_mechanic_id is a non-nullable FK).
    """
    from db.models import User
    result = await db_session.execute(
        select(User.id).where(User.email == SEED["mechanic"]["email"])
    )
    user_id = result.scalar_one_or_none()
    assert user_id is not None, (
        "mechanic_user_id: mechanic user not found. Did seed_users run?"
    )
    return str(user_id)


@pytest_asyncio.fixture
async def admin_user_id(db_session: AsyncSession) -> str:
    """DB id of admin@fleetms.com."""
    from db.models import User
    result = await db_session.execute(
        select(User.id).where(User.email == SEED["admin"]["email"])
    )
    user_id = result.scalar_one_or_none()
    assert user_id is not None, "admin_user_id: admin user not found."
    return str(user_id)


@pytest_asyncio.fixture
async def driver_user_id(db_session: AsyncSession) -> str:
    """
    DB id of driver.fixture@fleetms.com.
    Used as the user_id FK when creating Driver profile rows via the API.
    The E2E driver (kuriaj@fleetms.com) is a separate user — do not confuse.
    """
    from db.models import User
    result = await db_session.execute(
        select(User.id).where(User.email == SEED["driver_user"]["email"])
    )
    user_id = result.scalar_one_or_none()
    assert user_id is not None, "driver_user_id: driver fixture user not found."
    return str(user_id)


@pytest_asyncio.fixture
async def dispatcher_user_id(db_session: AsyncSession) -> str:
    """DB id of dispatcher@fleetms.com. Useful for trip RBAC assertions."""
    from db.models import User
    result = await db_session.execute(
        select(User.id).where(User.email == SEED["dispatcher"]["email"])
    )
    user_id = result.scalar_one_or_none()
    assert user_id is not None, "dispatcher_user_id: dispatcher user not found."
    return str(user_id)


# ─────────────────────────────────────────────────────────────────────────────
# FLEET FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_truck_id(auth_client: AsyncClient) -> str:
    """
    Create a Truck via the API and return its id.

    Plate is randomised to avoid unique-constraint collisions across
    parallel or repeated test runs.

    Required fields on Truck: plate_number, make, model, year.
    fuel_type and status have model-level defaults so are optional.
    """
    plate = f"TST-{uuid.uuid4().hex[:6].upper()}"
    res = await auth_client.post(
        "/api/v1/fleet/trucks",
        json={
            "plate_number": plate,
            "make": "Ford",
            "model": "Transit",
            "year": 2022,
            "fuel_type": "diesel",
        },
    )
    assert res.status_code == 201, (
        f"sample_truck_id fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]["id"]


@pytest_asyncio.fixture
async def sample_trailer_id(auth_client: AsyncClient) -> str:
    """
    Create a Trailer via the API and return its id.
    type enum: flatbed | refrigerated | tanker | box | other
    """
    plate = f"TRL-{uuid.uuid4().hex[:6].upper()}"
    res = await auth_client.post(
        "/api/v1/fleet/trailers",
        json={
            "plate_number": plate,
            "make": "Schmitz",
            "model": "S.CS",
            "year": 2021,
            "type": "flatbed",
        },
    )
    assert res.status_code == 201, (
        f"sample_trailer_id fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]["id"]


# ─────────────────────────────────────────────────────────────────────────────
# DRIVER FIXTURE
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_driver(auth_client: AsyncClient, driver_user_id: str) -> dict:
    """
    Create a Driver profile via the API and return the full driver dict.

    WHY TWO STEPS:
    Driver.user_id is a non-nullable, unique FK → users.id.
    The backing User (driver.fixture@fleetms.com) is seeded once per
    session in seed_users. We then POST to /api/v1/drivers to create the
    Driver profile that hangs off that user.

    license_number is randomised to avoid unique-constraint collisions.

    Required fields (non-nullable, no model default):
      user_id, first_name, last_name, email, phone,
      license_number, license_class, license_expiry_date, hire_date
    """
    license_num = f"DL-{uuid.uuid4().hex[:8].upper()}"
    res = await auth_client.post(
        "/api/v1/drivers",
        json={
            "user_id": driver_user_id,
            "first_name": "Fixture",
            "last_name": "Driver",
            "email": SEED["driver_user"]["email"],
            "phone": "+254700000001",
            "license_number": license_num,
            "license_class": "C",
            "license_expiry_date": "2027-12-31T00:00:00Z",
            "hire_date": "2023-01-15T00:00:00Z",
            "status": "active",
        },
    )
    assert res.status_code == 201, (
        f"sample_driver fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]


# ─────────────────────────────────────────────────────────────────────────────
# MAINTENANCE FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def work_order(
    auth_client: AsyncClient,
    sample_truck_id: str,
    mechanic_user_id: str,
) -> dict:
    """
    A single work order in 'pending' status.

    Required fields: truck_id, assigned_mechanic_id, title, description,
    scheduled_date. Priority defaults to 'medium'.
    Status defaults to 'pending' — the only valid starting state.
    """
    res = await auth_client.post(
        "/api/v1/maintenance/work-orders",
        json={
            "truck_id": sample_truck_id,
            "assigned_mechanic_id": mechanic_user_id,
            "title": "Fixture: brake inspection",
            "description": "Routine brake pad and rotor inspection.",
            "priority": "medium",
            "scheduled_date": "2025-07-01T09:00:00Z",
        },
    )
    assert res.status_code == 201, (
        f"work_order fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]


@pytest_asyncio.fixture
async def multiple_work_orders(
    auth_client: AsyncClient,
    sample_truck_id: str,
    mechanic_user_id: str,
) -> list[dict]:
    """Three work orders for pagination and filter tests."""
    orders = []
    for i in range(3):
        res = await auth_client.post(
            "/api/v1/maintenance/work-orders",
            json={
                "truck_id": sample_truck_id,
                "assigned_mechanic_id": mechanic_user_id,
                "title": f"Fixture WO #{i + 1}",
                "description": f"Pagination fixture work order {i + 1}.",
                "priority": "low",
                "scheduled_date": f"2025-08-0{i + 1}T09:00:00Z",
            },
        )
        assert res.status_code == 201, (
            f"multiple_work_orders fixture #{i + 1} failed: {res.text}"
        )
        orders.append(res.json()["data"])
    return orders


@pytest_asyncio.fixture
async def completed_work_order(
    auth_client: AsyncClient,
    work_order: dict,
) -> dict:
    """
    A work order progressed all the way to 'completed'.
    Drives through the required state machine: pending → in-progress → completed.

    WorkOrderStatusEnum: pending | in-progress | completed | overdue
    Note the hyphen in 'in-progress' (not underscore).
    """
    wo_id = work_order["id"]

    step1 = await auth_client.patch(
        f"/api/v1/maintenance/work-orders/{wo_id}/status",
        json={"status": "in-progress"},
    )
    assert step1.status_code == 200, (
        f"completed_work_order: in-progress transition failed: {step1.text}"
    )

    step2 = await auth_client.patch(
        f"/api/v1/maintenance/work-orders/{wo_id}/status",
        json={"status": "completed"},
    )
    assert step2.status_code == 200, (
        f"completed_work_order: completed transition failed: {step2.text}"
    )

    return step2.json()["data"]


@pytest_asyncio.fixture
async def work_order_with_part(
    auth_client: AsyncClient,
    work_order: dict,
) -> dict:
    """
    A work order with one part already attached.
    part_name (not 'name') and total_cost (non-nullable) are required.
    """
    wo_id = work_order["id"]
    qty = 2
    unit_cost = 15.00

    res = await auth_client.post(
        f"/api/v1/maintenance/work-orders/{wo_id}/parts",
        json={
            "part_name": "Fixture Part",
            "part_number": "FXT-PART-001",
            "quantity": qty,
            "unit_cost": unit_cost,
            "total_cost": qty * unit_cost,
        },
    )
    assert res.status_code == 201, (
        f"work_order_with_part fixture failed ({res.status_code}): {res.text}"
    )

    fetch = await auth_client.get(f"/api/v1/maintenance/work-orders/{wo_id}")
    assert fetch.status_code == 200
    return fetch.json()["data"]


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE SCHEDULE FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def service_schedule(
    auth_client: AsyncClient,
    sample_truck_id: str,
) -> dict:
    """
    A km-interval service schedule.
    next_service_date and next_service_odometer are computed server-side
    and must NOT be sent in the request payload.
    """
    res = await auth_client.post(
        "/api/v1/maintenance/schedules",
        json={
            "truck_id": sample_truck_id,
            "service_type": "oil_change",
            "interval_type": "km",
            "interval_value": 5000,
            "last_service_date": "2025-01-15T00:00:00Z",
            "last_service_odometer": 45000.0,
        },
    )
    assert res.status_code == 201, (
        f"service_schedule fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]


@pytest_asyncio.fixture
async def overdue_schedule(
    auth_client: AsyncClient,
    sample_truck_id: str,
) -> dict:
    """
    A schedule whose next service is long past due.
    last_service_date is set far in the past so this is always overdue
    regardless of when the tests run.
    """
    res = await auth_client.post(
        "/api/v1/maintenance/schedules",
        json={
            "truck_id": sample_truck_id,
            "service_type": "tire_rotation",
            "interval_type": "days",
            "interval_value": 30,
            "last_service_date": "2024-01-01T00:00:00Z",
            "last_service_odometer": 10000.0,
        },
    )
    assert res.status_code == 201, (
        f"overdue_schedule fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]


# ─────────────────────────────────────────────────────────────────────────────
# TRIP FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_trip(
    dispatcher_client: AsyncClient,
    sample_truck_id: str,
    sample_driver: dict,
) -> dict:
    """
    A pending trip created by the dispatcher.
    trip_number is auto-generated server-side — do not send it.
    TripStatusEnum: pending | en-route | completed | cancelled
    """
    res = await dispatcher_client.post(
        "/api/v1/trips",
        json={
            "origin": "Nairobi",
            "destination": "Mombasa",
            "scheduled_departure": "2025-09-01T06:00:00Z",
            "scheduled_arrival": "2025-09-01T14:00:00Z",
            "assigned_truck_id": sample_truck_id,
            "assigned_driver_id": sample_driver["id"],
            "cargo_description": "General goods",
            "cargo_weight_tons": 5.0,
            "distance_km": 480.0,
        },
    )
    assert res.status_code == 201, (
        f"sample_trip fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]


@pytest_asyncio.fixture
async def completed_trip(
    dispatcher_client: AsyncClient,
    sample_trip: dict,
) -> dict:
    """
    A trip driven to 'completed' state: pending → en-route → completed.
    """
    trip_id = sample_trip["id"]

    step1 = await dispatcher_client.patch(
        f"/api/v1/trips/{trip_id}/status",
        json={"status": "en-route"},
    )
    assert step1.status_code == 200, (
        f"completed_trip: en-route transition failed: {step1.text}"
    )

    step2 = await dispatcher_client.patch(
        f"/api/v1/trips/{trip_id}/status",
        json={"status": "completed"},
    )
    assert step2.status_code == 200, (
        f"completed_trip: completed transition failed: {step2.text}"
    )

    return step2.json()["data"]


# ─────────────────────────────────────────────────────────────────────────────
# FUEL LOG FIXTURE
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_fuel_log(
    auth_client: AsyncClient,
    sample_truck_id: str,
    sample_driver: dict,
) -> dict:
    """
    A single fuel log entry.
    total_cost is non-nullable — must equal litres × price_per_litre.
    """
    litres = 80.0
    price_per_litre = 1.45
    res = await auth_client.post(
        "/api/v1/fuel",
        json={
            "truck_id": sample_truck_id,
            "driver_id": sample_driver["id"],
            "litres": litres,
            "price_per_litre": price_per_litre,
            "total_cost": round(litres * price_per_litre, 2),
            "odometer_at_fuel": 52000.0,
            "logged_at": "2025-06-15T11:30:00Z",
            "station_name": "Total Nairobi West",
        },
    )
    assert res.status_code == 201, (
        f"sample_fuel_log fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE FIXTURE
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_expense(
    finance_client: AsyncClient,
    sample_truck_id: str,
) -> dict:
    """
    A single expense record submitted by the finance user.
    ExpenseCategoryEnum: fuel | maintenance | tolls | tyres |
                         insurance | licensing | salary | other
    """
    res = await finance_client.post(
        "/api/v1/expenses",
        json={
            "category": "maintenance",
            "amount": 4500.00,
            "currency": "KES",
            "description": "Brake pad replacement parts",
            "truck_id": sample_truck_id,
            "expense_date": "2025-06-10T00:00:00Z",
        },
    )
    assert res.status_code == 201, (
        f"sample_expense fixture failed ({res.status_code}): {res.text}"
    )
    return res.json()["data"]