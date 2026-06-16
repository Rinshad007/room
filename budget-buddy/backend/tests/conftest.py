import asyncio
import pytest
from app.db.session import async_engine, Base
from app.core.config import settings

# Force application environment to testing
settings.APP_ENV = "testing"

async def _reset_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await async_engine.dispose()

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    asyncio.run(_reset_db())
    yield
    asyncio.run(_reset_db())
