import pytest
import pymongo
from app.core.config import settings

# Force application environment to testing to redirect DB to test_budget_buddy
settings.APP_ENV = "testing"

def _clear_test_db_sync():
    # Use synchronous MongoClient to avoid event loop issues during teardown
    client = pymongo.MongoClient(settings.DATABASE_URL)
    client.drop_database("test_budget_buddy")
    client.close()

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    _clear_test_db_sync()
    yield
    _clear_test_db_sync()
