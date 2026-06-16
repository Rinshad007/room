from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification

class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self, user_id: str, title: str, message: str, notification_type: str
    ) -> Notification:
        n = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )
        self.db.add(n)
        await self.db.commit()
        return n

    async def get_user_notifications(self, user_id: str) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc()).limit(50)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_all_read(self, user_id: str) -> None:
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        await self.db.execute(stmt)
        await self.db.commit()
