import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings

def get_async_db_url(url: str) -> str:
    """Normalize connection URL to ensure it uses the asyncpg driver and resolve relative paths."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    # Resolve relative SQLite path to prevent database files being created in random directories
    if url.startswith("sqlite"):
        parts = url.split(":///")
        if len(parts) == 2:
            db_path = parts[1]
            if not os.path.isabs(db_path):
                # Resolve relative to the backend/ directory (session.py is app/db/session.py, so parent of parent of parent)
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                abs_db_path = os.path.abspath(os.path.join(backend_dir, db_path))
                url = f"{parts[0]}:///{abs_db_path}"
    return url

# Detect testing environment via settings or environment variables
is_testing = settings.APP_ENV == "testing" or os.getenv("APP_ENV") == "testing"

raw_url = settings.DATABASE_URL
if is_testing:
    # If using SQLite, redirect to a test-specific file
    if "sqlite" in raw_url:
        if "budget_buddy.db" in raw_url:
            raw_url = raw_url.replace("budget_buddy.db", "test_budget_buddy.db")
        else:
            raw_url = raw_url + "_test"
    else:
        raw_url = raw_url + "_test"

DATABASE_URL = get_async_db_url(raw_url)

if is_testing:
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
