from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class MessageModel(SQLModel, table=True):
    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(nullable=False, index=True)
    role: str = Field(nullable=False)
    content: dict = Field(sa_column=Column(JSON), default={})
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
