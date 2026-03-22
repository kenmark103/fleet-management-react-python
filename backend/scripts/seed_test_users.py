"""
tests/seed_test_users.py
Fleet Management System — E2E test user seeder

Creates the four non-admin test users required by tests/e2e/fixtures.ts.
Run once after the admin seed, or whenever the test DB is reset.

Usage (from project root):
    docker exec -it <api_container> python tests/seed_test_users.py

Credentials defined here MUST stay in sync with USERS in
tests/e2e/fixtures.ts. If you change a password here, change it there too.

Safe to re-run — skips any user whose email already exists.
"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select
from db.dbconfig import async_session
from db.models import User
from auth.security import hash_password


# ─────────────────────────────────────────────────────────────────────────────
# TEST USER DEFINITIONS — must match tests/e2e/fixtures.ts USERS exactly
# ─────────────────────────────────────────────────────────────────────────────

TEST_USERS = [
    {
        "first_name": "Mechanic",
        "last_name":  "User",
        "email":      "mechanic@fleetms.com",
        "password":   "Test1234!",
        "role":       "MECHANIC",
    },
    {
        "first_name": "Dispatcher",
        "last_name":  "User",
        "email":      "dispatcher@fleetms.com",
        "password":   "Dispatch1234!",
        "role":       "DISPATCHER",
    },
    {
        "first_name": "Finance",
        "last_name":  "User",
        "email":      "finance@fleetms.com",
        "password":   "Finance1234!",
        "role":       "FINANCE",
    },
    {
        "first_name": "Kuria",
        "last_name":  "J",
        "email":      "kuriaj@fleetms.com",
        "password":   "12345678",
        "role":       "DRIVER",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# SEEDER
# ─────────────────────────────────────────────────────────────────────────────

async def seed():
    async with async_session() as db:
        created = 0
        skipped = 0

        for u in TEST_USERS:
            result = await db.execute(
                select(User).where(User.email == u["email"])
            )
            if result.scalar_one_or_none():
                print(f"  — skipping {u['email']} (already exists)")
                skipped += 1
                continue

            user = User(
                first_name=  u["first_name"],
                last_name=   u["last_name"],
                email=       u["email"],
                password=    hash_password(u["password"]),
                role=        u["role"],
                status=      "active",
                is_active=   True,
                is_verified= True,       # skip email-verification flow for tests
            )
            db.add(user)
            await db.flush()             # get the auto-generated id before commit
            print(f"  ✓ {u['role']:<12} {u['email']}  (id: {user.id})")
            created += 1

        await db.commit()
        print(f"\nDone — {created} created, {skipped} skipped.")


if __name__ == "__main__":
    asyncio.run(seed())