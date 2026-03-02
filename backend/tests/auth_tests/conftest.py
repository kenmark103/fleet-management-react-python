# conftest.py
import pytest_asyncio

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine
from sqlalchemy.pool import NullPool

from httpx import AsyncClient, ASGITransport
from main import app
from db.base import Base
from db.dbconfig import get_async_session
from db.models import User
from auth.security import hash_password
from core.config import get_settings

# ----- Use a test DB; NullPool avoids connection reuse/concurrency in tests -----
settings= get_settings()
DATABASE_URL = settings.TEST_DATABASE_URL

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=NullPool,  # <<< critical for tests
    future=True,
)

SessionFactory = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

# ----- Dependency override: new session per request -----
async def override_get_async_session():
    async with SessionFactory() as session:
        yield session

app.dependency_overrides[get_async_session] = override_get_async_session

# ----- Create/drop schema for the whole test session -----
@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

# ----- httpx client with lifespan ON (startup hooks run) -----
@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(base_url="http://test", transport=transport) as c:
        yield c

# ----- Seeding fixture: separate session; commit and close before test runs -----
@pytest_asyncio.fixture
async def test_user():
    async with SessionFactory() as session:

        user = User(
            username="test_user",
            email="test_user@example.com",
            password=hash_password("test_pass"),
            role="user",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user