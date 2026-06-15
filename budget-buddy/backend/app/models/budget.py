import uuid
from datetime import datetime, timezone

class Budget:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.user_id = kwargs.get("user_id")
        self.month = int(kwargs.get("month") or 1)
        self.year = int(kwargs.get("year") or 2026)
        self.amount = float(kwargs.get("amount") or 0.0)
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
