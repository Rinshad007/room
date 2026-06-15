import uuid
from datetime import datetime, timezone
from typing import Optional
from app.models.group import Group, GroupMember
from app.models.user import User

class GroupRepository:
    def __init__(self, db):
        self.db = db
        self.collection = db["groups"]

    async def create(self, name: str, description: Optional[str], created_by: str) -> Group:
        group = Group(name=name, description=description, created_by=created_by)
        await self.collection.insert_one({
            "_id": group.id,
            "name": group.name,
            "description": group.description,
            "created_by": group.created_by,
            "created_at": group.created_at,
            "updated_at": group.updated_at,
            "members": []
        })
        return group

    async def get_by_id(self, group_id: str) -> Optional[Group]:
        doc = await self.collection.find_one({"_id": group_id})
        if not doc:
            return None
        group = Group(**doc)
        resolved_members = []
        for m in doc.get("members", []):
            user_doc = await self.db["users"].find_one({"_id": m["user_id"]})
            if user_doc:
                resolved_members.append(GroupMember(
                    id=m["id"],
                    group_id=group_id,
                    user_id=m["user_id"],
                    joined_at=m["joined_at"],
                    user=User(**user_doc)
                ))
        group.members = resolved_members
        return group

    async def get_user_groups(self, user_id: str) -> list[Group]:
        cursor = self.collection.find({"members.user_id": user_id})
        docs = await cursor.to_list(length=1000)
        groups = []
        for doc in docs:
            group = Group(**doc)
            resolved_members = []
            for m in doc.get("members", []):
                user_doc = await self.db["users"].find_one({"_id": m["user_id"]})
                if user_doc:
                    resolved_members.append(GroupMember(
                        id=m["id"],
                        group_id=group.id,
                        user_id=m["user_id"],
                        joined_at=m["joined_at"],
                        user=User(**user_doc)
                    ))
            group.members = resolved_members
            groups.append(group)
        return groups

    async def update(self, group: Group, **kwargs) -> Group:
        update_data = {}
        for key, value in kwargs.items():
            if value is not None:
                update_data[key] = value
                setattr(group, key, value)
        if update_data:
            await self.collection.update_one({"_id": group.id}, {"$set": update_data})
        return group

    async def delete(self, group: Group) -> None:
        await self.collection.delete_one({"_id": group.id})

    async def add_member(self, group_id: str, user_id: str) -> GroupMember:
        member_id = str(uuid.uuid4())
        joined_at = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"_id": group_id},
            {"$push": {"members": {
                "id": member_id,
                "user_id": user_id,
                "joined_at": joined_at
            }}}
        )
        return GroupMember(id=member_id, group_id=group_id, user_id=user_id, joined_at=joined_at)

    async def get_member(self, group_id: str, user_id: str) -> Optional[GroupMember]:
        doc = await self.collection.find_one(
            {"_id": group_id, "members.user_id": user_id},
            {"members.$": 1}
        )
        if doc and doc.get("members"):
            m = doc["members"][0]
            return GroupMember(id=m["id"], group_id=group_id, user_id=user_id, joined_at=m["joined_at"])
        return None

    async def remove_member(self, member: GroupMember) -> None:
        await self.collection.update_one(
            {"_id": member.group_id},
            {"$pull": {"members": {"user_id": member.user_id}}}
        )
