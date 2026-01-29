from collections.abc import AsyncGenerator
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from core.config import get_settings
from db.base import Base

settings=get_settings()
DatabaseUrl = settings.DATABASE_URL
engine = create_async_engine(DatabaseUrl)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def create_db_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


DB = Annotated[AsyncSession, Depends(get_async_session)]
