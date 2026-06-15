from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.api.users.schemas import UserPublic


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    member_ids: list[str] = Field(default_factory=list)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class GroupMemberPublic(BaseModel):
    id: str
    user: UserPublic
    joined_at: datetime

    model_config = {"from_attributes": True}


class GroupPublic(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_by: str
    created_at: datetime
    members: list[GroupMemberPublic] = []

    model_config = {"from_attributes": True}


class GroupListResponse(BaseModel):
    groups: list[GroupPublic]
    total: int


class AddMemberRequest(BaseModel):
    user_id: str
