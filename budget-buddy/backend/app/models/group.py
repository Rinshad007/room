import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.user import User

class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    members: Mapped[List["GroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", lazy="selectin"
    )

    def __init__(self, **kwargs):
        super().__init__()
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.name = kwargs.get("name")
        self.description = kwargs.get("description")
        self.created_by = kwargs.get("created_by")
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
        if "members" in kwargs:
            self.members = kwargs["members"]

class GroupMember(Base):
    __tablename__ = "group_members"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    group: Mapped["Group"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(lazy="selectin")

    def __init__(self, **kwargs):
        super().__init__()
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.group_id = kwargs.get("group_id")
        self.user_id = kwargs.get("user_id")
        self.joined_at = kwargs.get("joined_at") or datetime.now(timezone.utc)
        if "user" in kwargs:
            self.user = kwargs["user"]
