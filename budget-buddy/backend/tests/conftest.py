import os
# Force application environment to testing BEFORE importing session or settings
os.environ["APP_ENV"] = "testing"

import asyncio
import pytest
import pytest_asyncio
from app.core.config import settings
settings.APP_ENV = "testing"

from app.db.session import async_engine, Base

async def _reset_db():
    """Drop and recreate all tables"""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

@pytest_asyncio.fixture
async def setup_test_db():
    """Reset database before each test"""
    await _reset_db()
    yield
    await _reset_db()

@pytest.fixture(scope="function", autouse=True)
def _use_test_db(setup_test_db):
    """Automatically use test database setup for each test"""
    pass
