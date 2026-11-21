from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class ExpenseModel(SQLModel, table=True):
    __tablename__ = "expenses"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(nullable=False, index=True)
    title: str = Field(nullable=False)
    amount: float = Field(nullable=False)
    category: str = Field(default="Other", nullable=False)
    date: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
