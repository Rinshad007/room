from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.dependencies import CurrentUser
from app.api.notifications.schemas import NotificationListResponse
from app.api.notifications.service import NotificationService
from app.db.session import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get last 50 notifications for the current user."""
    service = NotificationService(db)
    return await service.list_notifications(current_user)


@router.post("/read-all", status_code=204)
async def mark_all_read(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark all notifications as read."""
    service = NotificationService(db)
    await service.mark_all_read(current_user)
