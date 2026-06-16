from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.friends.repository import FriendRepository
from app.api.friends.schemas import (
    FriendRequestCreate,
    FriendRequestResponse,
    FriendListResponse,
    FriendWithRequest,
    FriendPublic,
    PendingRequestsResponse,
)
from app.api.users.repository import UserRepository
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.logging import logger
from app.models.friendship import Friendship
from app.models.user import User


class FriendService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = FriendRepository(db)
        self.user_repo = UserRepository(db)

    async def send_request(self, current_user: User, data: FriendRequestCreate) -> FriendRequestResponse:
        if current_user.id == data.receiver_id:
            raise BadRequestException("Cannot send friend request to yourself")

        receiver = await self.user_repo.get_by_id(data.receiver_id)
        if not receiver:
            raise NotFoundException("User not found")

        existing = await self.repo.get_request(current_user.id, data.receiver_id)
        if existing:
            raise ConflictException("Friend request already exists")

        friendship = await self.repo.create_request(current_user.id, data.receiver_id)
        logger.info(f"Friend request sent: {current_user.id} -> {data.receiver_id}")
        return FriendRequestResponse.model_validate(friendship)

    async def accept_request(self, current_user: User, friendship_id: str) -> FriendRequestResponse:
        friendship = await self.repo.get_by_id(friendship_id)
        if not friendship:
            raise NotFoundException("Friend request not found")
        if friendship.receiver_id != current_user.id:
            raise ForbiddenException("Cannot accept this request")
        if friendship.status != "pending":
            raise BadRequestException(f"Request is already {friendship.status}")

        updated = await self.repo.update_status(friendship, "accepted")
        return FriendRequestResponse.model_validate(updated)

    async def reject_request(self, current_user: User, friendship_id: str) -> FriendRequestResponse:
        friendship = await self.repo.get_by_id(friendship_id)
        if not friendship:
            raise NotFoundException("Friend request not found")
        if friendship.receiver_id != current_user.id:
            raise ForbiddenException("Cannot reject this request")
        if friendship.status != "pending":
            raise BadRequestException(f"Request is already {friendship.status}")

        updated = await self.repo.update_status(friendship, "rejected")
        return FriendRequestResponse.model_validate(updated)

    async def remove_friend(self, current_user: User, friendship_id: str) -> None:
        friendship = await self.repo.get_by_id(friendship_id)
        if not friendship:
            raise NotFoundException("Friendship not found")
        if friendship.sender_id != current_user.id and friendship.receiver_id != current_user.id:
            raise ForbiddenException("Not part of this friendship")

        await self.repo.delete(friendship)

    async def get_friends(self, current_user: User) -> FriendListResponse:
        friendships = await self.repo.get_friends(current_user.id)
        friends = []
        for f in friendships:
            friend_id = f.receiver_id if f.sender_id == current_user.id else f.sender_id
            friend = await self.user_repo.get_by_id(friend_id)
            if friend:
                friends.append(
                    FriendWithRequest(
                        friendship_id=f.id,
                        friend=FriendPublic.model_validate(friend),
                        status=f.status,
                        created_at=f.created_at,
                    )
                )
        return FriendListResponse(friends=friends, total=len(friends))

    async def get_pending_requests(self, current_user: User) -> PendingRequestsResponse:
        sent = await self.repo.get_sent_requests(current_user.id)
        received = await self.repo.get_received_requests(current_user.id)
        
        received_list = []
        for f in received:
            sender = await self.user_repo.get_by_id(f.sender_id)
            if sender:
                received_list.append(
                    FriendWithRequest(
                        friendship_id=f.id,
                        friend=FriendPublic.model_validate(sender),
                        status=f.status,
                        created_at=f.created_at,
                    )
                )
        sent_list = []
        for f in sent:
            receiver = await self.user_repo.get_by_id(f.receiver_id)
            if receiver:
                sent_list.append(
                    FriendWithRequest(
                        friendship_id=f.id,
                        friend=FriendPublic.model_validate(receiver),
                        status=f.status,
                        created_at=f.created_at,
                    )
                )
        return PendingRequestsResponse(
            sent=sent_list,
            received=received_list,
        )
