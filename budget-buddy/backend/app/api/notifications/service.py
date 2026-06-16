from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.notifications.repository import NotificationRepository
from app.api.notifications.schemas import NotificationListResponse, NotificationPublic
from app.models.user import User


class NotificationService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = NotificationRepository(db)

    async def create(
        self,
        user_id: str,
        title: str,
        message: str,
        notification_type: str = "info",
    ) -> None:
        await self.repo.create(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )

    async def list_notifications(self, current_user: User) -> NotificationListResponse:
        notifications = await self.repo.get_user_notifications(current_user.id)
        unread = sum(1 for n in notifications if not n.is_read)
        return NotificationListResponse(
            notifications=[NotificationPublic.model_validate(n) for n in notifications],
            unread_count=unread,
        )

    async def mark_all_read(self, current_user: User) -> None:
        await self.repo.mark_all_read(current_user.id)
