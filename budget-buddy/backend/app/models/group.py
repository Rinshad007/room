import uuid
from datetime import datetime, timezone

class Group:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.name = kwargs.get("name")
        self.description = kwargs.get("description")
        self.created_by = kwargs.get("created_by")
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
        self.members = kwargs.get("members") or [] # list of GroupMember

class GroupMember:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.group_id = kwargs.get("group_id")
        self.user_id = kwargs.get("user_id")
        self.joined_at = kwargs.get("joined_at") or datetime.now(timezone.utc)
        self.user = kwargs.get("user") # User object or dict
