from typing import Optional
from datetime import datetime, timezone
from app.models.friendship import Friendship

class FriendRepository:
    def __init__(self, db):
        self.collection = db["friendships"]

    async def get_request(self, sender_id: str, receiver_id: str) -> Optional[Friendship]:
        doc = await self.collection.find_one({
            "$or": [
                {"sender_id": sender_id, "receiver_id": receiver_id},
                {"sender_id": receiver_id, "receiver_id": sender_id}
            ]
        })
        return Friendship(**doc) if doc else None

    async def get_by_id(self, friendship_id: str) -> Optional[Friendship]:
        doc = await self.collection.find_one({"_id": friendship_id})
        return Friendship(**doc) if doc else None

    async def create_request(self, sender_id: str, receiver_id: str) -> Friendship:
        friendship = Friendship(sender_id=sender_id, receiver_id=receiver_id, status="pending")
        await self.collection.insert_one({
            "_id": friendship.id,
            "sender_id": friendship.sender_id,
            "receiver_id": friendship.receiver_id,
            "status": friendship.status,
            "created_at": friendship.created_at,
            "updated_at": friendship.updated_at
        })
        return friendship

    async def update_status(self, friendship: Friendship, status: str) -> Friendship:
        friendship.status = status
        await self.collection.update_one(
            {"_id": friendship.id},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
        )
        return friendship

    async def delete(self, friendship: Friendship) -> None:
        await self.collection.delete_one({"_id": friendship.id})

    async def get_friends(self, user_id: str) -> list[Friendship]:
        cursor = self.collection.find({
            "$or": [
                {"sender_id": user_id},
                {"receiver_id": user_id}
            ],
            "status": "accepted"
        })
        docs = await cursor.to_list(length=1000)
        return [Friendship(**doc) for doc in docs]

    async def get_sent_requests(self, user_id: str) -> list[Friendship]:
        cursor = self.collection.find({"sender_id": user_id, "status": "pending"})
        docs = await cursor.to_list(length=1000)
        return [Friendship(**doc) for doc in docs]

    async def get_received_requests(self, user_id: str) -> list[Friendship]:
        cursor = self.collection.find({"receiver_id": user_id, "status": "pending"})
        docs = await cursor.to_list(length=1000)
        return [Friendship(**doc) for doc in docs]
