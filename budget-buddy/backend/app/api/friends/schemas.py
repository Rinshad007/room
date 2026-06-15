from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel


class FriendRequestCreate(BaseModel):
    receiver_id: str


class FriendRequestResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FriendPublic(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class FriendWithRequest(BaseModel):
    friendship_id: str
    friend: FriendPublic
    status: str
    created_at: datetime


class FriendListResponse(BaseModel):
    friends: list[FriendWithRequest]
    total: int


class PendingRequestsResponse(BaseModel):
    sent: list[FriendWithRequest]
    received: list[FriendWithRequest]
