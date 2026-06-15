from typing import Optional
from app.models.user import User

class AuthRepository:
    def __init__(self, db):
        self.collection = db["users"]

    async def get_by_email(self, email: str) -> Optional[User]:
        doc = await self.collection.find_one({"email": email})
        return User(**doc) if doc else None

    async def get_by_id(self, user_id: str) -> Optional[User]:
        doc = await self.collection.find_one({"_id": user_id})
        return User(**doc) if doc else None

    async def create(self, name: str, email: str, password_hash: str) -> User:
        user = User(name=name, email=email, password_hash=password_hash)
        await self.collection.insert_one({
            "_id": user.id,
            "name": user.name,
            "email": user.email,
            "password_hash": user.password_hash,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at,
            "updated_at": user.updated_at
        })
        return user
