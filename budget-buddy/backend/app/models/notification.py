import uuid
from datetime import datetime, timezone

class Notification:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.user_id = kwargs.get("user_id")
        self.title = kwargs.get("title")
        self.message = kwargs.get("message")
        self.notification_type = kwargs.get("notification_type") or "info"
        self.is_read = bool(kwargs.get("is_read") or False)
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
