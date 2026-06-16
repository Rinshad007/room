import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.group import Group, GroupMember
from app.models.user import User

class GroupRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, name: str, description: Optional[str], created_by: str) -> Group:
        group = Group(name=name, description=description, created_by=created_by)
        self.db.add(group)
        await self.db.commit()
        return group

    async def get_by_id(self, group_id: str) -> Optional[Group]:
        return await self.db.get(Group, group_id)

    async def get_user_groups(self, user_id: str) -> list[Group]:
        stmt = select(Group).join(GroupMember).where(GroupMember.user_id == user_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(self, group: Group, **kwargs) -> Group:
        for key, value in kwargs.items():
            if value is not None:
                setattr(group, key, value)
        group.updated_at = datetime.now(timezone.utc)
        self.db.add(group)
        await self.db.commit()
        return group

    async def delete(self, group: Group) -> None:
        await self.db.delete(group)
        await self.db.commit()

    async def add_member(self, group_id: str, user_id: str) -> GroupMember:
        member = GroupMember(group_id=group_id, user_id=user_id)
        self.db.add(member)
        await self.db.commit()
        # Return refreshed member to load relations if any
        stmt = select(GroupMember).where(GroupMember.id == member.id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_member(self, group_id: str, user_id: str) -> Optional[GroupMember]:
        stmt = select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def remove_member(self, member: GroupMember) -> None:
        await self.db.delete(member)
        await self.db.commit()
