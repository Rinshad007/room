from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationPublic(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationPublic]
    unread_count: int
