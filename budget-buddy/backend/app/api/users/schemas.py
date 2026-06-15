from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserSearchResponse(BaseModel):
    users: list[UserPublic]
    total: int
