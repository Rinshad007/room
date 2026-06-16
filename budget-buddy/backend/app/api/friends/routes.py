from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.dependencies import CurrentUser
from app.api.friends.schemas import (
    FriendRequestCreate,
    FriendRequestResponse,
    FriendListResponse,
    PendingRequestsResponse,
)
from app.api.friends.service import FriendService
from app.db.session import get_db

router = APIRouter(prefix="/friends", tags=["Friends"])


@router.post("/request", response_model=FriendRequestResponse, status_code=201)
async def send_friend_request(
    data: FriendRequestCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a friend request to another user."""
    service = FriendService(db)
    return await service.send_request(current_user, data)


@router.post("/{friendship_id}/accept", response_model=FriendRequestResponse)
async def accept_friend_request(
    friendship_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept a pending friend request."""
    service = FriendService(db)
    return await service.accept_request(current_user, friendship_id)


@router.post("/{friendship_id}/reject", response_model=FriendRequestResponse)
async def reject_friend_request(
    friendship_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reject a pending friend request."""
    service = FriendService(db)
    return await service.reject_request(current_user, friendship_id)


@router.delete("/{friendship_id}", status_code=204)
async def remove_friend(
    friendship_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove a friend."""
    service = FriendService(db)
    await service.remove_friend(current_user, friendship_id)


@router.get("/", response_model=FriendListResponse)
async def list_friends(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all accepted friends."""
    service = FriendService(db)
    return await service.get_friends(current_user)


@router.get("/pending", response_model=PendingRequestsResponse)
async def pending_requests(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get sent and received pending friend requests."""
    service = FriendService(db)
    return await service.get_pending_requests(current_user)
