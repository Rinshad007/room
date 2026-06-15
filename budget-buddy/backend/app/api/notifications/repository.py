from typing import Optional
from app.models.notification import Notification

class NotificationRepository:
    def __init__(self, db):
        self.collection = db["notifications"]

    async def create(
        self, user_id: str, title: str, message: str, notification_type: str
    ) -> Notification:
        n = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )
        await self.collection.insert_one({
            "_id": n.id,
            "user_id": n.user_id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at
        })
        return n

    async def get_user_notifications(self, user_id: str) -> list[Notification]:
        cursor = self.collection.find({"user_id": user_id}).sort("created_at", -1).limit(50)
        docs = await cursor.to_list(length=50)
        return [Notification(**doc) for doc in docs]

    async def mark_all_read(self, user_id: str) -> None:
        await self.collection.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True}}
        )
