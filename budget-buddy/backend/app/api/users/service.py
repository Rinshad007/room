from sqlalchemy.ext.asyncio import AsyncSession

from app.api.users.repository import UserRepository
from app.api.users.schemas import UserPublic, UserUpdateRequest, UserSearchResponse
from app.core.exceptions import NotFoundException
from app.models.user import User


class UserService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def get_profile(self, user_id: str) -> UserPublic:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        return UserPublic.model_validate(user)

    async def update_profile(self, current_user: User, data: UserUpdateRequest) -> UserPublic:
        updated = await self.repo.update(current_user, **data.model_dump(exclude_none=True))
        return UserPublic.model_validate(updated)

    async def search_users(self, query: str, current_user: User) -> UserSearchResponse:
        users = await self.repo.search(query=query, exclude_id=current_user.id)
        return UserSearchResponse(
            users=[UserPublic.model_validate(u) for u in users],
            total=len(users),
        )
