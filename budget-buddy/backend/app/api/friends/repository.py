from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.friendship import Friendship

class FriendRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_request(self, sender_id: str, receiver_id: str) -> Optional[Friendship]:
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.sender_id == sender_id, Friendship.receiver_id == receiver_id),
                and_(Friendship.sender_id == receiver_id, Friendship.receiver_id == sender_id)
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_id(self, friendship_id: str) -> Optional[Friendship]:
        return await self.db.get(Friendship, friendship_id)

    async def create_request(self, sender_id: str, receiver_id: str) -> Friendship:
        friendship = Friendship(sender_id=sender_id, receiver_id=receiver_id, status="pending")
        self.db.add(friendship)
        await self.db.commit()
        return friendship

    async def update_status(self, friendship: Friendship, status: str) -> Friendship:
        friendship.status = status
        friendship.updated_at = datetime.now(timezone.utc)
        self.db.add(friendship)
        await self.db.commit()
        return friendship

    async def delete(self, friendship: Friendship) -> None:
        await self.db.delete(friendship)
        await self.db.commit()

    async def get_friends(self, user_id: str) -> list[Friendship]:
        stmt = select(Friendship).where(
            or_(Friendship.sender_id == user_id, Friendship.receiver_id == user_id),
            Friendship.status == "accepted"
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_sent_requests(self, user_id: str) -> list[Friendship]:
        stmt = select(Friendship).where(Friendship.sender_id == user_id, Friendship.status == "pending")
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_received_requests(self, user_id: str) -> list[Friendship]:
        stmt = select(Friendship).where(Friendship.receiver_id == user_id, Friendship.status == "pending")
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
