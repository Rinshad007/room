from typing import Optional
from app.models.user import User

class UserRepository:
    def __init__(self, db):
        self.collection = db["users"]

    async def get_by_id(self, user_id: str) -> Optional[User]:
        doc = await self.collection.find_one({"_id": user_id})
        return User(**doc) if doc else None

    async def search(self, query: str, exclude_id: str, limit: int = 20) -> list[User]:
        cursor = self.collection.find({
            "_id": {"$ne": exclude_id},
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ]
        }).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [User(**doc) for doc in docs]

    async def update(self, user: User, **kwargs) -> User:
        update_data = {}
        for key, value in kwargs.items():
            if value is not None:
                update_data[key] = value
                setattr(user, key, value)
        if update_data:
            await self.collection.update_one({"_id": user.id}, {"$set": update_data})
        return user
