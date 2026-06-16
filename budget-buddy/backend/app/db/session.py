from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings

def get_async_db_url(url: str) -> str:
    """Normalize connection URL to ensure it uses the asyncpg driver."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

DATABASE_URL = get_async_db_url(settings.DATABASE_URL)

if settings.APP_ENV == "testing":
    async_engine = create_async_engine(DATABASE_URL, poolclass=NullPool, echo=False)
else:
    async_engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

from datetime import datetime
from sqlalchemy import DateTime

class Base(DeclarativeBase):
    type_annotation_map = {
        datetime: DateTime(timezone=True),
    }

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
