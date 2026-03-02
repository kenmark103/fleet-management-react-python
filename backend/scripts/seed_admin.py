import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select
from db.dbconfig import async_session
from db.models import User
from auth.security import hash_password


async def seed():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == "admin@fleetms.com"))
        if result.scalar_one_or_none():
            print("Admin already exists — skipping.")
            return

        admin = User(
            first_name="Admin",
            last_name="User",
            email="admin@fleetms.com",
            password=hash_password("Admin1234!"),
            role="ADMIN",
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        print(f"✓ Admin created: {admin.email}  (id: {admin.id})")


if __name__ == "__main__":
    asyncio.run(seed())