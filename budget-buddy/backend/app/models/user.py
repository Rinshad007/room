import uuid
from datetime import datetime, timezone

class User:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.name = kwargs.get("name")
        self.email = kwargs.get("email")
        self.password_hash = kwargs.get("password_hash")
        self.avatar_url = kwargs.get("avatar_url")
        self.upi_id = kwargs.get("upi_id")  # e.g. user@okaxis
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
