import asyncio
import pytest
from app.db.session import async_engine, Base
from app.core.config import settings

# Force application environment to testing
settings.APP_ENV = "testing"

@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop to run all tests in the same loop."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
async def setup_database():
    """Recreate database schema once for the entire test session."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
