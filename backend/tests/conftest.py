import os
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from db.models import User
from  main import app
from db.base import Base
from db.dbconfig import get_async_session
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql+asyncpg://postgres:qwerty@localhost:5432/fleet_management_test_db")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def override_get_async_session():
    async with AsyncSessionLocal() as session:
        yield session

app.dependency_overrides[get_async_session] = override_get_async_session

@pytest_asyncio.fixture(scope="session")
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(base_url="http://test", transport=transport) as client:
        yield client

@pytest_asyncio.fixture
async def db():
    async with AsyncSessionLocal() as session:
        yield session

@pytest_asyncio.fixture
async def test_user(db):
    user = User(
        username="test_user",
        email="test_user@example.com",
        password="test_pass",
        role="user"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user



