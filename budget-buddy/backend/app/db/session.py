import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

# Cache clients per event loop to support test runners like pytest-asyncio
_clients = {}

def get_database_reference():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.get_event_loop_policy().get_event_loop()
        
    if loop not in _clients:
        _clients[loop] = AsyncIOMotorClient(settings.DATABASE_URL, serverSelectionTimeoutMS=3000)
        
    db_name = "test_budget_buddy" if settings.APP_ENV == "testing" else "budget_buddy"
    return _clients[loop].get_database(db_name)

class DBProxy:
    """A proxy object that resolves database calls dynamically to the current active event loop's MongoDB database connection."""
    def __getattr__(self, name):
        db = get_database_reference()
        return getattr(db, name)
        
    def __getitem__(self, name):
        db = get_database_reference()
        return db[name]

# Expose a proxy that behaves exactly like the database object
db = DBProxy()

async def get_db():
    yield get_database_reference()
