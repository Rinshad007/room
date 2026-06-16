from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.groups.repository import GroupRepository
from app.api.groups.schemas import (
    AddMemberRequest,
    GroupCreate,
    GroupListResponse,
    GroupPublic,
    GroupUpdate,
)
from app.api.users.repository import UserRepository
from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.logging import logger
from app.models.user import User


class GroupService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = GroupRepository(db)
        self.user_repo = UserRepository(db)

    async def create_group(self, current_user: User, data: GroupCreate) -> GroupPublic:
        group = await self.repo.create(
            name=data.name, description=data.description, created_by=current_user.id
        )
        # Add creator as first member
        await self.repo.add_member(group.id, current_user.id)

        # Add additional members
        for uid in data.member_ids:
            if uid != current_user.id:
                user = await self.user_repo.get_by_id(uid)
                if user:
                    await self.repo.add_member(group.id, uid)

        group = await self.repo.get_by_id(group.id)
        logger.info(f"Group created: {group.name} by {current_user.email}")
        return GroupPublic.model_validate(group)

    async def get_group(self, current_user: User, group_id: str) -> GroupPublic:
        group = await self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundException("Group not found")
        member = await self.repo.get_member(group_id, current_user.id)
        if not member:
            raise ForbiddenException("Not a member of this group")
        return GroupPublic.model_validate(group)

    async def list_groups(self, current_user: User) -> GroupListResponse:
        groups = await self.repo.get_user_groups(current_user.id)
        return GroupListResponse(
            groups=[GroupPublic.model_validate(g) for g in groups],
            total=len(groups),
        )

    async def update_group(self, current_user: User, group_id: str, data: GroupUpdate) -> GroupPublic:
        group = await self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundException("Group not found")
        if group.created_by != current_user.id:
            raise ForbiddenException("Only the group creator can update it")
        updated = await self.repo.update(group, **data.model_dump(exclude_none=True))
        return GroupPublic.model_validate(await self.repo.get_by_id(updated.id))

    async def delete_group(self, current_user: User, group_id: str) -> None:
        group = await self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundException("Group not found")
        if group.created_by != current_user.id:
            raise ForbiddenException("Only the group creator can delete it")
        await self.repo.delete(group)

    async def add_member(self, current_user: User, group_id: str, data: AddMemberRequest) -> GroupPublic:
        group = await self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundException("Group not found")
        if group.created_by != current_user.id:
            raise ForbiddenException("Only the group creator can add members")
        user = await self.user_repo.get_by_id(data.user_id)
        if not user:
            raise NotFoundException("User not found")
        existing = await self.repo.get_member(group_id, data.user_id)
        if existing:
            raise ConflictException("User is already a member")
        await self.repo.add_member(group_id, data.user_id)
        return GroupPublic.model_validate(await self.repo.get_by_id(group_id))

    async def remove_member(self, current_user: User, group_id: str, user_id: str) -> GroupPublic:
        group = await self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundException("Group not found")
        if group.created_by != current_user.id and current_user.id != user_id:
            raise ForbiddenException("Permission denied")
        member = await self.repo.get_member(group_id, user_id)
        if not member:
            raise NotFoundException("Member not found in group")
        await self.repo.remove_member(member)
        return GroupPublic.model_validate(await self.repo.get_by_id(group_id))
